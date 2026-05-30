import * as THREE from "three";
import { loadingManager, camera } from "../utils/three-setup.js";
function setupAudio() {
  const listener = new THREE.AudioListener();
  camera.add(listener);

  const sound = new THREE.Audio(listener);
  const audioLoader = new THREE.AudioLoader(loadingManager);

  audioLoader.load("/assets/audio/sleep.mp3", function (buffer) {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.setVolume(0.3);

    // Wait until loading screen is gone before adding the button
    const checkGalleryReady = setInterval(() => {
      const loadingScreen = document.getElementById("loading-screen");
      if (!loadingScreen || loadingScreen.style.display === "none") {
        clearInterval(checkGalleryReady);
        createAudioButton(sound);
      }
    }, 300);
  });
}

function createAudioButton(sound) {
  const muteButton = document.createElement("button");
  muteButton.id = "audio-toggle-button";
  muteButton.className =
    "museum-mobile-control museum-desktop-control audio-muted";
  muteButton.type = "button";
  muteButton.textContent = "♪";
  muteButton.setAttribute("aria-label", "Begin ambient audio");

  document.body.appendChild(muteButton);

  const handleMuteToggle = function (event) {
    event.preventDefault();
    event.stopPropagation();

    if (sound.isPlaying) {
      sound.pause();
      muteButton.classList.add("audio-muted");
      muteButton.setAttribute("aria-label", "Begin ambient audio");
    } else {
      sound.play();
      muteButton.classList.remove("audio-muted");
      muteButton.setAttribute("aria-label", "Mute ambient audio");
    }
  };

  muteButton.addEventListener("touchstart", handleMuteToggle, {
    passive: false,
  });
  muteButton.addEventListener("click", handleMuteToggle);
}

export { setupAudio };
