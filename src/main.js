import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { scene, camera, renderer } from "./utils/three-setup.js";
import { createRoom, addArtwork } from "./components/Gallery.js";
import {
  controls,
  velocity,
  direction,
  moveForward,
  moveBackward,
  moveLeft,
  moveRight,
  clampCameraRotation, // ⬅️ add this new import
} from "./components/Controls.js";
import { setupAudio } from "./components/AudioPlayer.js";
import { ArtworkManager } from "./components/Artwork.js";

// 🧭 Set initial spawn reference — unified for desktop & mobile
function setupSpawnReference(scene, camera, isMobile) {
  // Set consistent camera position and direction
  camera.position.set(0, 1.6, 5);
  camera.lookAt(0, 1.5, 0); // face toward the main wall

  // Sync pointer lock controls with camera (for desktop)
  controls.getObject().position.copy(camera.position);
  controls.getObject().rotation.copy(camera.rotation);

  if (isMobile) {
    // Optional: subtle floor marker for mobile orientation
    const loader = new THREE.TextureLoader();
    const markerTex = loader.load("./assets/images/start_marker.png"); // placeholder texture
    const markerGeo = new THREE.CircleGeometry(0.4, 32);
    const markerMat = new THREE.MeshBasicMaterial({
      map: markerTex,
      transparent: true,
      opacity: 0.6,
    });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(0, 0.01, 0);
    scene.add(marker);
  }
}

// Touch / tablet detection
// iPads often identify as desktop browsers, especially in landscape or desktop-mode Safari.
// For this gallery, any touch-capable device should receive the mobile movement orb.
function isMobileDevice() {
  const userAgent = navigator.userAgent || "";
  const isTraditionalMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent,
    );

  const isTouchCapable =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0;

  const prefersTouch =
    window.matchMedia?.("(pointer: coarse)")?.matches ||
    window.matchMedia?.("(hover: none)")?.matches;

  return isTraditionalMobile || isTouchCapable || prefersTouch;
}

const isMobile = isMobileDevice();

// Set pixel ratio for mobile
if (isMobile) {
  renderer.setPixelRatio(window.devicePixelRatio / 2); // Reduce pixel ratio
}

document.body.appendChild(renderer.domElement);
// ✨ Show signature after entering the gallery
const startButton = document.getElementById("start-button");

const returnHomeButton = document.createElement("button");
returnHomeButton.type = "button";
returnHomeButton.id = "return-home-button";
returnHomeButton.classList.add("museum-mobile-control");
returnHomeButton.setAttribute(
  "aria-label",
  isMobile ? "Return to home" : "Return to entrance",
);
returnHomeButton.textContent = isMobile ? "‹" : "← Return to Entrance";

returnHomeButton.style.position = "fixed";
returnHomeButton.style.zIndex = "9998";
returnHomeButton.style.border = "1px solid rgba(245,241,234,0.18)";
returnHomeButton.style.background = "rgba(8,8,8,0.28)";
returnHomeButton.style.color = "rgba(245,241,234,0.72)";
returnHomeButton.style.backdropFilter = "blur(12px)";
returnHomeButton.style.webkitBackdropFilter = "blur(12px)";
returnHomeButton.style.boxShadow = "0 14px 40px rgba(0,0,0,0.18)";
returnHomeButton.style.cursor = "pointer";
returnHomeButton.style.opacity = "0";
returnHomeButton.style.pointerEvents = "none";
returnHomeButton.style.transition =
  "opacity 0.6s ease, color 0.3s ease, background 0.3s ease";

if (isMobile) {
  // Mobile styles handled globally in CSS
} else {
  returnHomeButton.style.right = "32px";
  returnHomeButton.style.bottom = "28px";
  returnHomeButton.style.borderRadius = "999px";
  returnHomeButton.style.padding = "10px 16px";
  returnHomeButton.style.fontFamily = "Cormorant Garamond, serif";
  returnHomeButton.style.fontSize = "1rem";
  returnHomeButton.style.letterSpacing = "0.08em";
}

returnHomeButton.addEventListener("mouseenter", () => {
  returnHomeButton.style.color = "rgba(245,241,234,0.96)";
  returnHomeButton.style.background = "rgba(8,8,8,0.42)";
});

returnHomeButton.addEventListener("mouseleave", () => {
  returnHomeButton.style.color = "rgba(245,241,234,0.72)";
  returnHomeButton.style.background = "rgba(8,8,8,0.28)";
});

function showReturnHomeButton() {
  window.setTimeout(() => {
    returnHomeButton.style.opacity = "1";
    returnHomeButton.style.pointerEvents = "auto";
  }, 4200);
}

function showMobileJoystick(joystick, joystickThumb) {
  if (!joystick) return;

  window.setTimeout(() => {
    joystick.style.opacity = "1";
    joystick.style.pointerEvents = "auto";

    // Brief onboarding pulse for discoverability.
    // CSS animation classes are added in global.css next.
    if (joystickThumb) {
      joystick.classList.add("joystick-discoverable");
      joystickThumb.classList.add("joystick-thumb-discoverable");

      window.setTimeout(() => {
        joystick.classList.remove("joystick-discoverable");
        joystickThumb.classList.remove("joystick-thumb-discoverable");
      }, 4200);
    }
  }, 1200);
}

function returnToEntrance(event) {
  event.preventDefault();
  event.stopPropagation();
  window.location.reload();
}

returnHomeButton.addEventListener("click", returnToEntrance);
returnHomeButton.addEventListener("touchstart", returnToEntrance, {
  passive: false,
});

document.body.appendChild(returnHomeButton);

function unlockMobileAudio() {
  const audioElements = document.querySelectorAll("audio");

  audioElements.forEach((audio) => {
    audio.muted = false;
    audio.volume = audio.volume || 0.45;

    if (audio.paused) {
      audio.play().catch(() => {
        // Mobile browsers may still block autoplay until another direct tap.
      });
    }
  });

  const audioContext =
    THREE.AudioContext?.getContext?.() ||
    THREE.AudioContext?.context ||
    window.AudioContext ||
    window.webkitAudioContext;

  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume?.().catch?.(() => {});
  }
}

if (startButton) {
  startButton.addEventListener("click", () => {
    unlockMobileAudio(); // fade in 2s after entry
    showReturnHomeButton();
  });

  startButton.addEventListener(
    "touchstart",
    () => {
      unlockMobileAudio();
      showReturnHomeButton();
    },
    {
      once: true,
      passive: true,
    },
  );

  startButton.addEventListener(
    "touchend",
    () => {
      unlockMobileAudio();
      showReturnHomeButton();
    },
    {
      once: true,
      passive: true,
    },
  );
}

// ✅ Prevent pull-to-refresh / overscroll on mobile browsers
if (isMobile) {
  document.body.style.overscrollBehavior = "none";
  document.documentElement.style.overscrollBehavior = "none";
  document.body.style.touchAction = "none";

  // Prevent the downward swipe from triggering a refresh
  window.addEventListener(
    "touchmove",
    (event) => {
      // Allow pinch zoom but block one-finger drags
      if (event.touches.length > 1 || (event.scale && event.scale !== 1))
        return;
      if (event.target.closest?.(".cultural-panel")) return;
      event.preventDefault();
    },
    { passive: false },
  );
}

let activeLookTouchId = null;
let lookTouchX = 0;
let lookTouchY = 0;

function isInteractiveOverlay(target) {
  return Boolean(
    target.closest?.(".joystick-control") ||
      target.closest?.(".cultural-panel") ||
      target.closest?.("#artwork-info") ||
      target.closest?.("button") ||
      target.closest?.("a") ||
      target.closest?.("input") ||
      target.closest?.("textarea"),
  );
}

function getTouchById(touches, id) {
  return Array.from(touches).find((touch) => touch.identifier === id);
}

function handleTouchStart(event) {
  if (!isMobile) return;
  if (activeLookTouchId !== null) return;
  if (isInteractiveOverlay(event.target)) return;

  const touch = event.changedTouches[0];
  activeLookTouchId = touch.identifier;
  lookTouchX = touch.clientX;
  lookTouchY = touch.clientY;
}

function handleTouchMove(event) {
  if (!isMobile || activeLookTouchId === null) return;
  if (document.body.classList.contains("cultural-panel-open")) return;

  const touch = getTouchById(event.touches, activeLookTouchId);
  if (!touch) return;

  const dx = touch.clientX - lookTouchX;
  const dy = touch.clientY - lookTouchY;

  // Drag direction follows the visitor's finger on touch devices.
  camera.rotation.y -= dx * 0.0024;
  camera.rotation.x -= dy * 0.0024;

  lookTouchX = touch.clientX;
  lookTouchY = touch.clientY;
}

function handleTouchEnd(event) {
  if (activeLookTouchId === null) return;

  const endedLookTouch = getTouchById(event.changedTouches, activeLookTouchId);
  if (!endedLookTouch) return;

  activeLookTouchId = null;
  lookTouchX = 0;
  lookTouchY = 0;
}

// Initialize components
const artworkManager = new ArtworkManager(scene, camera);
const clock = new THREE.Clock();

// Disable pointer lock on mobile
// Mobile controls (touch look + movement)
if (isMobile) {
  // Look controls (already defined)
  document.body.addEventListener("touchstart", handleTouchStart, {
    passive: false,
  });
  document.body.addEventListener("touchmove", handleTouchMove, {
    passive: false,
  });
  document.body.addEventListener("touchend", handleTouchEnd, {
    passive: false,
  });
  document.body.addEventListener("touchcancel", handleTouchEnd, {
    passive: false,
  });

  // Add a simple virtual joystick

  const joystick = document.createElement("div");
  joystick.className = "joystick-control";

  joystick.style.position = "fixed";
  joystick.style.bottom = "calc(90px + env(safe-area-inset-bottom, 0px))";
  joystick.style.left = "calc(40px + env(safe-area-inset-left, 0px))";
  joystick.style.width = "110px";
  joystick.style.height = "110px";
  joystick.style.borderRadius = "50%";
  joystick.style.background = "rgba(255,255,255,0.18)";
  joystick.style.border = "2px solid rgba(255,255,255,0.45)";
  joystick.style.boxShadow = "0 0 22px rgba(255,255,255,0.25)";
  joystick.style.touchAction = "none";
  joystick.style.zIndex = "9999";
  joystick.style.opacity = "0";
  joystick.style.pointerEvents = "none";
  joystick.style.transition = "opacity 0.8s ease";

  const joystickThumb = document.createElement("div");
  joystickThumb.style.position = "absolute";
  joystickThumb.style.top = "50%";
  joystickThumb.style.left = "50%";
  joystickThumb.style.width = "34px";
  joystickThumb.style.height = "34px";
  joystickThumb.style.transform = "translate(-50%, -50%)";
  joystickThumb.style.borderRadius = "50%";
  joystickThumb.style.background = "rgba(255,255,255,0.42)";
  joystickThumb.style.border = "1px solid rgba(255,255,255,0.68)";
  joystickThumb.style.boxShadow = "0 0 14px rgba(255,255,255,0.35)";
  joystickThumb.style.pointerEvents = "none";
  joystick.appendChild(joystickThumb);

  document.body.appendChild(joystick);

  console.log("Touch movement orb enabled", {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    width: window.innerWidth,
    height: window.innerHeight,
  });

  if (startButton) {
    startButton.addEventListener(
      "click",
      () => {
        showMobileJoystick(joystick, joystickThumb);
      },
      { once: true },
    );

    startButton.addEventListener(
      "touchstart",
      () => {
        showMobileJoystick(joystick, joystickThumb);
      },
      { once: true, passive: true },
    );
  }

  let joystickActive = false;
  let moveX = 0,
    moveY = 0;

  joystick.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      joystickActive = true;
      const touch = e.changedTouches[0];
      joystick.dataset.touchId = touch.identifier;
      joystick.dataset.startX = touch.clientX;
      joystick.dataset.startY = touch.clientY;
      joystickThumb.style.transform = "translate(-50%, -50%) scale(1.08)";
    },
    { passive: false },
  );

  joystick.addEventListener(
    "touchmove",
    (e) => {
      if (!joystickActive) return;
      e.preventDefault();
      e.stopPropagation();

      const joystickTouchId = Number(joystick.dataset.touchId);
      const touch = getTouchById(e.touches, joystickTouchId);
      if (!touch) return;

      const dx = touch.clientX - Number(joystick.dataset.startX);
      const dy = touch.clientY - Number(joystick.dataset.startY);
      const clampedX = Math.max(-45, Math.min(45, dx));
      const clampedY = Math.max(-45, Math.min(45, dy));

      moveX = Math.max(-0.65, Math.min(0.65, dx / 70));
      moveY = Math.max(-0.65, Math.min(0.65, dy / 70));
      joystickThumb.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;
    },
    { passive: false },
  );

  function resetJoystick() {
    joystickActive = false;
    moveX = 0;
    moveY = 0;
    joystick.dataset.touchId = "";
    joystickThumb.style.transform = "translate(-50%, -50%)";
  }

  joystick.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const joystickTouchId = Number(joystick.dataset.touchId);
      const endedJoystickTouch = getTouchById(
        e.changedTouches,
        joystickTouchId,
      );
      if (endedJoystickTouch) resetJoystick();
    },
    { passive: false },
  );

  joystick.addEventListener(
    "touchcancel",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetJoystick();
    },
    { passive: false },
  );

  // Override animate() movement for mobile
  const originalAnimate = animate;
  animate = function mobileAnimate() {
    requestAnimationFrame(mobileAnimate);
    const delta = clock.getDelta();

    if (joystickActive) {
      const moveSpeed = 2.2 * delta;

      // Move relative to the camera's facing direction (natural control)
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0; // prevent vertical drift
      forward.normalize();

      const right = new THREE.Vector3();
      right.crossVectors(forward, camera.up).normalize();

      // Use joystick input to move in facing direction
      const nextPosition = camera.position.clone();
      nextPosition.addScaledVector(forward, -moveY * moveSpeed);
      nextPosition.addScaledVector(right, moveX * moveSpeed);

      const roomWidth = 20;
      const roomLength = 20;
      const wallBuffer = 2.8;

      const isInsideSafeGalleryArea =
        nextPosition.x > -roomWidth / 2 + wallBuffer &&
        nextPosition.x < roomWidth / 2 - wallBuffer &&
        nextPosition.z > -roomLength / 2 + wallBuffer &&
        nextPosition.z < roomLength / 2 - wallBuffer;

      if (isInsideSafeGalleryArea) {
        camera.position.copy(nextPosition);
      }
    }

    // Clamp camera inside a comfortable walking area, before reaching the walls
    const wallBuffer = 2.8;
    const roomWidth = 20;
    const roomLength = 20;
    camera.position.x = Math.min(
      Math.max(camera.position.x, -roomWidth / 2 + wallBuffer),
      roomWidth / 2 - wallBuffer,
    );
    camera.position.z = Math.min(
      Math.max(camera.position.z, -roomLength / 2 + wallBuffer),
      roomLength / 2 - wallBuffer,
    );

    // ✅ Prevent over-tilting on mobile too
    clampCameraRotation();

    artworkManager.update();
    renderer.render(scene, camera);
  };
}

// Room dimensions (shared between Gallery.js and boundary checks)
const roomLength = 20;

// Collision detection
const raycaster = new THREE.Raycaster(
  new THREE.Vector3(),
  new THREE.Vector3(0, -1, 0),
  0,
  10,
);

// Render loop
function animate() {
  requestAnimationFrame(animate);

  if (controls.isLocked) {
    const delta = clock.getDelta();

    // Calculate movement
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    if (moveForward || moveBackward) velocity.z -= direction.z * 20.0 * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * 20.0 * delta;

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);

    // Keep within a comfortable walking area, before reaching the walls
    const wallBuffer = 2.8;
    const roomWidth = 20;
    if (camera.position.x < -roomWidth / 2 + wallBuffer)
      camera.position.x = -roomWidth / 2 + wallBuffer;
    if (camera.position.x > roomWidth / 2 - wallBuffer)
      camera.position.x = roomWidth / 2 - wallBuffer;
    if (camera.position.z < -roomLength / 2 + wallBuffer)
      camera.position.z = -roomLength / 2 + wallBuffer;
    if (camera.position.z > roomLength / 2 - wallBuffer)
      camera.position.z = roomLength / 2 - wallBuffer;
  }

  // ✅ Clamp camera pitch so it can’t spin to the ceiling/floor
  clampCameraRotation();

  // Update artwork proximity detection
  artworkManager.update();

  renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize everything
function init() {
  // Create the room and add artwork
  createRoom();
  addArtwork(artworkManager);

  // 🧭 Set initial camera spawn orientation (fixed view)
  setupSpawnReference(scene, camera, isMobile);

  // Setup audio (adds its own start button)
  setupAudio();

  if (isMobile) {
    const unlockOnFirstTouch = () => {
      unlockMobileAudio();
      window.removeEventListener("touchstart", unlockOnFirstTouch);
      window.removeEventListener("pointerdown", unlockOnFirstTouch);
    };

    window.addEventListener("touchstart", unlockOnFirstTouch, {
      once: true,
      passive: true,
    });

    window.addEventListener("pointerdown", unlockOnFirstTouch, {
      once: true,
      passive: true,
    });
  }

  // Start the render loop
  animate();
  clampCameraRotation();
}

// Start the application
init();
