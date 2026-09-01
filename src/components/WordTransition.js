import * as THREE from "three";

const WORD_STAGES = {
  1: {
    script: "ಅಹಂ",
    transliteration: "aham",
    meaning: "I",
  },
  2: {
    script: "ಬಿಂಬ",
    transliteration: "bimba",
    meaning: "there is me",
  },
  3: {
    script: "ಪ್ರತಿಬಿಂಬ",
    transliteration: "pratibimba",
    meaning: "there is my reflection",
  },
  4: {
    script: "ಮಾಯಾ",
    transliteration: "māyā",
    meaning: "the boundary becomes uncertain",
  },
  5: {
    script: "ಸಾಕ್ಷಿ",
    transliteration: "sākṣī",
    meaning: "witness-consciousness",
  },
  6: {
    script: "ಅದ್ವೈತ",
    transliteration: "advaita",
    meaning: "non-duality",
  },
};

export class WordTransitionManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.activeTransitions = [];
    this.completedStages = new Set();
    this.isCompactScreen = this.detectCompactScreen();
  }

  detectCompactScreen() {
    const userAgent = navigator.userAgent || "";
    const isPhone =
      /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        userAgent,
      );
    const isIPad =
      /iPad/i.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const narrowPhoneViewport = window.innerWidth <= 767;

    return isPhone || isIPad || narrowPhoneViewport;
  }

  showStage(stageIndex, artworkMesh = null) {
    if (this.completedStages.has(stageIndex)) return;
    if (this.isCompactScreen && stageIndex !== 1 && stageIndex !== 6) return;

    const stage = WORD_STAGES[stageIndex];
    if (!stage) return;

    this.completedStages.add(stageIndex);

    const compactWord = this.isCompactScreen && stageIndex !== 6;
    const texture = this.createWordTexture(stage, compactWord);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const sprite = new THREE.Sprite(material);
    sprite.position.copy(this.getFloorPosition(artworkMesh));
    sprite.scale.set(
      compactWord ? 1.55 : stageIndex === 6 ? 2.9 : 2.35,
      compactWord ? 1.35 : stageIndex === 6 ? 2.25 : 1.9,
      1,
    );
    sprite.renderOrder = 20;

    const glow = this.createFloorGlow(sprite.position, stageIndex === 6);

    this.scene.add(sprite);
    this.scene.add(glow);

    this.activeTransitions.push({
      sprite,
      glow,
      texture,
      startedAt: performance.now(),
      duration: compactWord ? 5600 : stageIndex === 6 ? 9800 : 7600,
      rise: compactWord ? 4.6 : stageIndex === 6 ? 5.6 : 3.8,
      startY: sprite.position.y,
      baseScale: sprite.scale.clone(),
    });
  }

  update() {
    const now = performance.now();

    this.activeTransitions = this.activeTransitions.filter((transition) => {
      const progress = Math.min(
        1,
        (now - transition.startedAt) / transition.duration,
      );

      const riseEase = 1 - Math.pow(1 - progress, 2.2);
      const fadeIn = THREE.MathUtils.smoothstep(progress, 0.04, 0.2);
      const fadeOut = 1 - THREE.MathUtils.smoothstep(progress, 0.72, 1);
      const opacity = fadeIn * fadeOut;

      transition.sprite.position.y =
        transition.startY + riseEase * transition.rise;
      transition.sprite.material.opacity = opacity * 0.92;
      transition.sprite.scale
        .copy(transition.baseScale)
        .multiplyScalar(1 + progress * 0.08);

      const glowPulse = 0.55 + Math.sin(now * 0.003) * 0.12;
      transition.glow.material.opacity = opacity * glowPulse * 0.44;
      transition.glow.scale.setScalar(1 + progress * 0.42);

      if (progress < 1) return true;

      this.scene.remove(transition.sprite);
      this.scene.remove(transition.glow);
      transition.sprite.material.dispose();
      transition.glow.material.dispose();
      transition.glow.geometry.dispose();
      transition.texture.dispose();
      return false;
    });
  }

  getFloorPosition(artworkMesh) {
    if (!artworkMesh) {
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();

      return this.camera.position
        .clone()
        .addScaledVector(forward, 2.8)
        .setY(0.28);
    }

    const visitor = this.camera.position.clone();
    const target = artworkMesh.position.clone();
    visitor.y = 0;
    target.y = 0;

    const towardArtwork = target.sub(visitor);
    if (towardArtwork.lengthSq() < 0.001) {
      return this.camera.position.clone().setY(0.42);
    }

    towardArtwork.normalize();

    return visitor
      .addScaledVector(towardArtwork, this.isCompactScreen ? 2.9 : 2.55)
      .setY(this.isCompactScreen ? 0.55 : 0.42);
  }

  createFloorGlow(position, isFinalStage) {
    const ring = new THREE.RingGeometry(
      this.isCompactScreen && !isFinalStage ? 0.22 : isFinalStage ? 0.45 : 0.32,
      this.isCompactScreen && !isFinalStage ? 0.38 : isFinalStage ? 0.72 : 0.52,
      96,
    );
    const material = new THREE.MeshBasicMaterial({
      color: 0xf4d6a2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(ring, material);
    glow.position.copy(position);
    glow.position.y = 0.04;
    glow.rotation.x = -Math.PI / 2;
    glow.renderOrder = 19;

    return glow;
  }

  createWordTexture(stage, compactWord = false) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;

    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.textAlign = "center";
    context.textBaseline = "middle";

    const centerX = canvas.width / 2;
    const glow = context.createRadialGradient(
      centerX,
      520,
      20,
      centerX,
      520,
      390,
    );
    glow.addColorStop(0, "rgba(245, 214, 162, 0.2)");
    glow.addColorStop(0.45, "rgba(245, 214, 162, 0.06)");
    glow.addColorStop(1, "rgba(245, 214, 162, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.shadowColor = "rgba(244, 214, 162, 0.72)";
    context.shadowBlur = 28;
    context.fillStyle = "rgba(245, 231, 198, 0.96)";
    context.font = `${compactWord ? 184 : 132}px "Noto Sans Kannada", "Noto Serif Kannada", "Kannada MN", serif`;
    context.fillText(stage.script, centerX, compactWord ? 500 : 420);

    if (compactWord) {
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;

      return texture;
    }

    context.shadowBlur = 16;
    context.fillStyle = "rgba(245, 231, 198, 0.82)";
    context.font = '34px "Cormorant Garamond", Georgia, serif';
    context.fillText(stage.transliteration, centerX, 560);

    context.shadowBlur = 8;
    context.fillStyle = "rgba(245, 231, 198, 0.58)";
    context.font = '25px "Nunito Sans", -apple-system, sans-serif';
    context.fillText(stage.meaning, centerX, 618);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    return texture;
  }
}
