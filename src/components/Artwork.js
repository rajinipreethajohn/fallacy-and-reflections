// Artwork.js - Handles artwork interactions in the virtual gallery

import * as THREE from "three";

export class ArtworkManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.artworks = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.selectedArtwork = null;
    this.infoPanel = document.getElementById("artwork-info");
    this.artworkTitle = document.getElementById("artwork-title");
    this.artworkDescription = document.getElementById("artwork-description");
    this.artworkArtist = document.getElementById("artwork-artist");
    this.plaqueCue = this.createPlaqueCue();
    this.endDispatched = false;
    this.viewedSequences = new Set();
    this.totalSequenceCount = 5;
    this.activeCueTargetIndex = null;
    this.pendingCueTargetIndex = null;
    this.plaqueCueTargetArtwork = null;
    this.cueRevealTimer = null;
    this.wayfindingCue = this.createWayfindingCue();
    this.wallWayfindingCue = this.createWallWayfindingCue();

    // Setup event listeners
    document.addEventListener("mousemove", this.onMouseMove.bind(this));
    document.addEventListener("click", this.onMouseClick.bind(this));

    // Proximity detection
    this.proximityDistance = 5; // Distance at which artwork info appears
    const toggleExpandedInfoPanel = (event) => {
      event.stopPropagation();

      if (window.innerWidth <= 768) {
        this.infoPanel.classList.toggle("expanded");
      }
    };

    this.infoPanel.addEventListener(
      "touchstart",

      toggleExpandedInfoPanel,

      { passive: true },
    );
  }

  createPlaqueCue() {
    if (!this.infoPanel) return null;

    const cue = document.createElement("div");
    cue.className = "plaque-wayfinding-cue";
    cue.setAttribute("aria-hidden", "true");
    cue.innerHTML = "<span></span><span></span>";
    this.infoPanel.appendChild(cue);

    return cue;
  }

  // Add a new artwork to the collection
  addArtwork(
    mesh,
    title,
    artist,
    description,
    year,
    sequence,
    sequenceIndex,
    isFinalArtwork,
  ) {
    this.artworks.push({
      mesh,
      info: {
        title,
        artist,
        description,
        year,
        sequence,
        sequenceIndex,
        isFinalArtwork,
      },
      originalMaterial: mesh.material.clone(),
    });

    // Return the mesh for further customization if needed
    return mesh;
  }

  // Load artwork from image with metadata
  loadArtwork(imagePath, position, rotation, scale, metadata) {
    const loader = new THREE.TextureLoader();

    return new Promise((resolve) => {
      loader.load(imagePath, (texture) => {
        // Calculate aspect ratio for the frame
        const aspectRatio = texture.image.width / texture.image.height;
        const width = scale.x;
        const height = width / aspectRatio;

        // Create the artwork mesh with enhanced material
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshStandardMaterial({
          map: texture,
          side: THREE.DoubleSide,
          metalness: 0.1,
          roughness: 0.4,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: 0.15,
          emissiveMap: texture,
        });

        const artwork = new THREE.Mesh(geometry, material);
        artwork.position.copy(position);
        artwork.rotation.copy(rotation);
        artwork.castShadow = true;
        artwork.receiveShadow = true;

        // Add a subtle glow plane behind the artwork
        const glowGeometry = new THREE.PlaneGeometry(width + 0.1, height + 0.1);
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.15,
          side: THREE.DoubleSide,
        });

        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.copy(position);
        glow.rotation.copy(rotation);

        // Move glow slightly behind artwork
        const offset = new THREE.Vector3(0, 0, -0.02);
        offset.applyEuler(rotation);
        glow.position.add(offset);

        this.scene.add(glow);

        // Add to scene
        this.scene.add(artwork);

        // Add to managed artworks
        const managedArtwork = this.addArtwork(
          artwork,
          metadata.title,
          metadata.artist,
          metadata.description,
          metadata.year,
          metadata.sequence,
          metadata.sequenceIndex,
          metadata.isFinalArtwork,
        );

        // Add frame if requested
        if (metadata.frame) {
          this.addFrame(artwork, width, height); // Removed color parameter
        }

        // Add specific lighting for this artwork if requested
        if (metadata.spotlight) {
          this.addSpotlight(
            artwork,
            position,
            metadata.spotlightColor || 0xffffff,
          );
        }

        resolve(managedArtwork);
      });
    });
  }

  // Add a decorative thick black frame around artwork
  addFrame(artworkMesh, width, height) {
    // Removed color parameter
    const frameWidth = 0.2; // Thickness of the frame border sides
    const frameDepth = 0.05; // Depth of the frame

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000, // Black color
      roughness: 0.6,
      metalness: 0.2,
    });

    // Create frame pieces (top, bottom, left, right)
    const geometries = {
      top: new THREE.BoxGeometry(
        width + 2 * frameWidth,
        frameWidth,
        frameDepth,
      ),
      bottom: new THREE.BoxGeometry(
        width + 2 * frameWidth,
        frameWidth,
        frameDepth,
      ),
      left: new THREE.BoxGeometry(frameWidth, height, frameDepth),
      right: new THREE.BoxGeometry(frameWidth, height, frameDepth),
    };

    const framePieces = {};
    const offsets = {
      top: new THREE.Vector3(0, height / 2 + frameWidth / 2, 0),
      bottom: new THREE.Vector3(0, -height / 2 - frameWidth / 2, 0),
      left: new THREE.Vector3(-width / 2 - frameWidth / 2, 0, 0),
      right: new THREE.Vector3(width / 2 + frameWidth / 2, 0, 0),
    };

    // Create and position each frame piece relative to the artwork
    for (const side in geometries) {
      const piece = new THREE.Mesh(geometries[side], frameMaterial);

      // Apply artwork's rotation to the offset vector
      const rotatedOffset = offsets[side]
        .clone()
        .applyEuler(artworkMesh.rotation);

      // Position the piece relative to the artwork center + offset
      piece.position.copy(artworkMesh.position).add(rotatedOffset);

      // Apply artwork's rotation to the piece itself
      piece.rotation.copy(artworkMesh.rotation);

      // Move frame slightly behind artwork plane to avoid z-fighting
      const depthOffset = new THREE.Vector3(0, 0, -0.01);
      depthOffset.applyEuler(artworkMesh.rotation);
      piece.position.add(depthOffset);

      this.scene.add(piece);
      framePieces[side] = piece;
    }
    // No return needed as pieces are added directly to the scene
  }

  // Add a spotlight focused on the artwork
  addSpotlight(artworkMesh, position, color) {
    const spotLight = new THREE.SpotLight(color, 2.5); // Increased intensity

    // Position the light based on artwork orientation
    const direction = new THREE.Vector3(0, 0, 1);
    direction.applyEuler(artworkMesh.rotation);
    direction.multiplyScalar(-2); // Moved closer to artwork (2 units instead of 3)

    // Offset the light position slightly upward
    const upOffset = new THREE.Vector3(0, 0.5, 0);
    spotLight.position.copy(position).add(direction).add(upOffset);

    // Calculate position for the light to point at the artwork
    const target = new THREE.Object3D();
    target.position.copy(position);
    this.scene.add(target);
    spotLight.target = target;

    // Configure spotlight for more focused, dramatic lighting
    spotLight.angle = Math.PI / 8; // Narrower angle
    spotLight.penumbra = 0.3; // Softer edges
    spotLight.decay = 1.5; // Less decay for stronger light
    spotLight.distance = 10; // Shorter distance for more intensity
    spotLight.castShadow = true;

    // Higher quality shadows
    spotLight.shadow.mapSize.width = 2048;
    spotLight.shadow.mapSize.height = 2048;
    spotLight.shadow.camera.near = 0.1;
    spotLight.shadow.camera.far = 15;
    spotLight.shadow.focus = 1; // Sharp shadows

    this.scene.add(spotLight);
    return spotLight;
  }

  createWayfindingCue() {
    const cue = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
      color: 0xf5e7c6,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const chevronShape = new THREE.Shape();
    chevronShape.moveTo(-0.42, 0);
    chevronShape.lineTo(0, 0.54);
    chevronShape.lineTo(0.42, 0);
    chevronShape.lineTo(0.26, 0);
    chevronShape.lineTo(0, 0.32);
    chevronShape.lineTo(-0.26, 0);
    chevronShape.lineTo(-0.42, 0);

    const geometry = new THREE.ShapeGeometry(chevronShape);

    [0, 0.42].forEach((offset) => {
      const chevron = new THREE.Mesh(geometry, material);
      chevron.rotation.x = -Math.PI / 2;
      chevron.position.z = offset;
      cue.add(chevron);
    });

    cue.position.y = 0.035;
    cue.visible = false;
    cue.userData.material = material;
    this.scene.add(cue);

    return cue;
  }

  createWallWayfindingCue() {
    const cue = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
      color: 0xf5e7c6,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const chevronShape = new THREE.Shape();
    chevronShape.moveTo(-0.32, 0);
    chevronShape.lineTo(0, 0.42);
    chevronShape.lineTo(0.32, 0);
    chevronShape.lineTo(0.2, 0);
    chevronShape.lineTo(0, 0.25);
    chevronShape.lineTo(-0.2, 0);
    chevronShape.lineTo(-0.32, 0);

    const geometry = new THREE.ShapeGeometry(chevronShape);

    [0, 0.32].forEach((offset) => {
      const chevron = new THREE.Mesh(geometry, material);
      chevron.position.y = offset;
      cue.add(chevron);
    });

    cue.visible = false;
    cue.userData.material = material;
    this.scene.add(cue);

    return cue;
  }

  showWayfindingCue(fromArtwork, targetArtwork) {
    if (!fromArtwork || !targetArtwork || !this.wayfindingCue) return;

    const from = fromArtwork.mesh.position.clone();
    const target = targetArtwork.mesh.position.clone();
    const visitor = this.camera.position.clone();
    from.y = 0;
    target.y = 0;
    visitor.y = 0;

    const direction = target.sub(from);
    if (direction.lengthSq() < 0.001) return;
    direction.normalize();

    const distanceFromArtwork = visitor.distanceTo(from);
    const isCloseToArtwork = distanceFromArtwork < 3.2;
    const isWallArtwork = fromArtwork.info.sequenceIndex !== 1;

    if (isCloseToArtwork && isWallArtwork) {
      this.showWallWayfindingCue(fromArtwork, targetArtwork);
      this.showPlaqueCue(targetArtwork);
      this.wayfindingCue.visible = false;
      return;
    }

    if (this.wallWayfindingCue) {
      this.wallWayfindingCue.visible = false;
    }
    this.showPlaqueCue(targetArtwork);

    const cuePosition = isCloseToArtwork
      ? visitor.addScaledVector(direction, 1.85)
      : from.addScaledVector(direction, 2.2);

    cuePosition.x = Math.max(-7.2, Math.min(7.2, cuePosition.x));
    cuePosition.z = Math.max(-7.2, Math.min(7.2, cuePosition.z));
    cuePosition.y = 0.035;

    this.wayfindingCue.position.copy(cuePosition);
    this.wayfindingCue.rotation.y = Math.atan2(-direction.x, -direction.z);
    this.wayfindingCue.visible = true;
    this.activeCueTargetIndex = targetArtwork.info.sequenceIndex;
    this.pendingCueTargetIndex = null;
  }

  showPlaqueCue(targetArtwork) {
    if (!this.plaqueCue || !targetArtwork) return;

    this.plaqueCueTargetArtwork = targetArtwork;
    const targetDirection = targetArtwork.mesh.position
      .clone()
      .sub(this.camera.position)
      .applyQuaternion(this.camera.quaternion.clone().invert());
    const directionClass = targetDirection.x < 0 ? "is-left" : "is-right";

    this.plaqueCue.classList.remove("is-left", "is-right", "is-visible");
    this.plaqueCue.classList.add(directionClass);
    window.requestAnimationFrame(() => {
      this.plaqueCue.classList.add("is-visible");
    });
  }

  showCameraFloorCue(targetArtwork) {
    if (!this.wayfindingCue || !targetArtwork) return;

    const visitor = this.camera.position.clone();
    const target = targetArtwork.mesh.position.clone();
    visitor.y = 0;
    target.y = 0;

    const direction = target.sub(visitor);
    if (direction.lengthSq() < 0.001) return;
    direction.normalize();

    const cuePosition = visitor.addScaledVector(direction, 2.05);
    cuePosition.x = Math.max(-7.2, Math.min(7.2, cuePosition.x));
    cuePosition.z = Math.max(-7.2, Math.min(7.2, cuePosition.z));
    cuePosition.y = 0.035;

    this.wayfindingCue.position.copy(cuePosition);
    this.wayfindingCue.rotation.y = Math.atan2(-direction.x, -direction.z);
    this.wayfindingCue.visible = true;
    this.activeCueTargetIndex = targetArtwork.info.sequenceIndex;
  }

  maybeHandOffPlaqueCue() {
    if (!this.plaqueCue?.classList.contains("is-visible")) return;
    if (!this.plaqueCueTargetArtwork) return;

    const targetDirection = this.plaqueCueTargetArtwork.mesh.position
      .clone()
      .sub(this.camera.position)
      .applyQuaternion(this.camera.quaternion.clone().invert());

    const targetIsInView =
      targetDirection.z < -0.2 &&
      Math.abs(targetDirection.x) < Math.abs(targetDirection.z) * 0.92;

    if (!targetIsInView) return;

    this.plaqueCue.classList.remove("is-visible");
    if (this.wallWayfindingCue) {
      this.wallWayfindingCue.visible = false;
    }
    this.showCameraFloorCue(this.plaqueCueTargetArtwork);
    this.plaqueCueTargetArtwork = null;
  }

  showWallWayfindingCue(fromArtwork, targetArtwork) {
    if (!this.wallWayfindingCue) return;

    const currentPosition = fromArtwork.mesh.position.clone();
    const targetPosition = targetArtwork.mesh.position.clone();
    const worldDirection = targetPosition.sub(currentPosition);
    worldDirection.y = 0;

    const localDirection = worldDirection
      .clone()
      .applyQuaternion(fromArtwork.mesh.quaternion.clone().invert());

    const side = localDirection.x >= 0 ? 1 : -1;
    const wallOffset = new THREE.Vector3(side * 1.1, -1.65, 0.08);
    wallOffset.applyEuler(fromArtwork.mesh.rotation);

    this.wallWayfindingCue.position.copy(currentPosition).add(wallOffset);
    this.wallWayfindingCue.rotation.copy(fromArtwork.mesh.rotation);
    this.wallWayfindingCue.children.forEach((chevron) => {
      chevron.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    });
    this.wallWayfindingCue.visible = true;
    this.activeCueTargetIndex = targetArtwork.info.sequenceIndex;
    this.pendingCueTargetIndex = null;
  }

  hideWayfindingCue() {
    if (!this.wayfindingCue) return;
    this.wayfindingCue.visible = false;
    if (this.wallWayfindingCue) {
      this.wallWayfindingCue.visible = false;
    }
    this.activeCueTargetIndex = null;
    this.pendingCueTargetIndex = null;
    this.plaqueCue?.classList.remove("is-visible");
    this.plaqueCueTargetArtwork = null;
    clearTimeout(this.cueRevealTimer);
  }

  findNextCueTarget(currentInfo) {
    if (!currentInfo?.sequenceIndex) return null;

    const orderedArtworks = [...this.artworks].sort(
      (a, b) => (a.info.sequenceIndex || 0) - (b.info.sequenceIndex || 0),
    );

    const nextInSequence = orderedArtworks.find(
      (artwork) => artwork.info.sequenceIndex === currentInfo.sequenceIndex + 1,
    );

    if (
      nextInSequence &&
      !this.viewedSequences.has(nextInSequence.info.sequenceIndex)
    ) {
      return nextInSequence;
    }

    return orderedArtworks.find(
      (artwork) => !this.viewedSequences.has(artwork.info.sequenceIndex),
    );
  }

  queueWayfindingCue(currentInfo) {
    const currentArtwork = this.artworks.find(
      (artwork) => artwork.info.sequenceIndex === currentInfo.sequenceIndex,
    );
    const targetArtwork = this.findNextCueTarget(currentInfo);

    if (!currentArtwork || !targetArtwork) {
      this.hideWayfindingCue();
      return;
    }

    if (
      this.activeCueTargetIndex === targetArtwork.info.sequenceIndex ||
      this.pendingCueTargetIndex === targetArtwork.info.sequenceIndex
    ) {
      return;
    }

    clearTimeout(this.cueRevealTimer);
    this.pendingCueTargetIndex = targetArtwork.info.sequenceIndex;
    this.cueRevealTimer = window.setTimeout(() => {
      this.showWayfindingCue(currentArtwork, targetArtwork);
    }, 2200);
  }

  recordArtworkEncounter(info) {
    if (!info?.sequenceIndex || this.endDispatched) return;

    this.viewedSequences.add(info.sequenceIndex);

    if (this.viewedSequences.size >= this.totalSequenceCount) {
      this.endDispatched = true;
      this.hideWayfindingCue();

      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("stillhaus:exhibition-end"));
      }, 1600);
      return;
    }

    this.queueWayfindingCue(info);
  }

  // Handle mouse movement for hovering effect
  onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  // Handle mouse clicks for selecting artwork
  onMouseClick(event) {
    // Update raycaster with camera and mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Find intersected objects
    const intersects = this.raycaster.intersectObjects(
      this.artworks.map((artwork) => artwork.mesh),
    );

    // If we intersected with an artwork
    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      const artwork = this.artworks.find((art) => art.mesh === clickedMesh);

      if (artwork) {
        this.selectArtwork(artwork);
      }
    } else {
      this.deselectArtwork();
    }
  }

  // Select an artwork and show its info
  selectArtwork(artwork) {
    // Deselect previous artwork if any
    if (this.selectedArtwork && this.selectedArtwork !== artwork) {
      this.selectedArtwork.mesh.material =
        this.selectedArtwork.originalMaterial.clone();
    }

    // Select new artwork
    this.selectedArtwork = artwork;

    // Apply highlight effect
    const highlightMaterial = artwork.originalMaterial.clone();
    highlightMaterial.emissive = new THREE.Color(0x222222);
    artwork.mesh.material = highlightMaterial;

    // Show artwork info
    this.showArtworkInfo(artwork.info);
  }

  // Deselect current artwork
  deselectArtwork() {
    if (this.selectedArtwork) {
      this.selectedArtwork.mesh.material =
        this.selectedArtwork.originalMaterial.clone();
      this.selectedArtwork = null;
      this.hideArtworkInfo();
    }
  }

  // Show artwork information panel
  showArtworkInfo(info) {
    if (!document.body.classList.contains("gallery-entered")) return;
    if (!info || !this.infoPanel || !this.artworkDescription) return;

    if (this.artworkTitle) {
      if (info.sequence) {
        this.artworkTitle.textContent = info.sequence;
        this.artworkTitle.style.display = "block";
      } else {
        this.artworkTitle.style.display = "none";
      }
    }

    if (this.artworkArtist) {
      this.artworkArtist.style.display = "none";
    }

    this.artworkDescription.textContent =
      info.description || "A quiet reflection within the gallery.";

    this.artworkDescription.style.display = "block";

    this.artworkDescription.style.opacity = "1";

    this.artworkDescription.style.visibility = "visible";

    this.infoPanel.style.display = "block";
    this.recordArtworkEncounter(info);
  }

  // Hide artwork information panel
  hideArtworkInfo() {
    this.infoPanel.style.display = "none";
    this.plaqueCue?.classList.remove("is-visible");
    this.plaqueCueTargetArtwork = null;
  }

  // Check for proximity to artworks and show info when close
  checkProximity() {
    if (!document.body.classList.contains("gallery-entered")) {
      this.hideArtworkInfo();
      return;
    }

    if (!this.camera) return;

    let closestDistance = Infinity;
    let closestArtwork = null;

    // Check distance to each artwork
    for (const artwork of this.artworks) {
      const distance = this.camera.position.distanceTo(artwork.mesh.position);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestArtwork = artwork;
      }
    }

    // If we're close enough to any artwork, show its info
    if (closestDistance < this.proximityDistance && closestArtwork) {
      this.showArtworkInfo(closestArtwork.info);
    } else if (!this.selectedArtwork) {
      this.hideArtworkInfo();
    }
  }

  // Update function called each frame
  update() {
    this.checkProximity();
    this.maybeHandOffPlaqueCue();

    if (this.wayfindingCue?.visible) {
      const opacity = 0.18 + Math.sin(performance.now() * 0.0024) * 0.08;
      this.wayfindingCue.userData.material.opacity = opacity;
    }

    if (this.wallWayfindingCue?.visible) {
      const opacity = 0.2 + Math.sin(performance.now() * 0.0024) * 0.09;
      this.wallWayfindingCue.userData.material.opacity = opacity;
    }
  }
}
