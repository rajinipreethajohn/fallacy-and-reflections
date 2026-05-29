import * as THREE from "three";
import { scene, loadingManager } from "../utils/three-setup.js";

// Texture Loader
const textureLoader = new THREE.TextureLoader(loadingManager);

// Room dimensions
const roomWidth = 20;
const roomHeight = 12;
const roomLength = 20;

// Artwork dimensions
const artWidth = 3.5;
const artHeight = 2.5;

function createRoom() {
  // Walls
  const roomGeometry = new THREE.BoxGeometry(roomWidth, roomHeight, roomLength);
  const roomMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, // Bright white walls
    side: THREE.BackSide,
    roughness: 0.8, // Slightly less rough for a bit more light bounce
    metalness: 0.1,
  });
  const room = new THREE.Mesh(roomGeometry, roomMaterial);
  room.receiveShadow = true;
  scene.add(room);

  // Floor with texture
  const floorTexture = textureLoader.load("/assets/textures/medieval_wood.jpg");
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(2, 2); // Reduced repeat

  const floorGeometry = new THREE.PlaneGeometry(roomWidth, roomLength);
  const floorMaterial = new THREE.MeshStandardMaterial({
    map: floorTexture,
    roughness: 0.7,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.05; // Slightly raise floor to avoid z-fighting if needed
  floor.receiveShadow = true;
  scene.add(floor);

  // Brighter ambient light for overall illumination
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // White, much brighter
  scene.add(ambientLight);

  // Create ceiling tracks (lighter color)
  const trackMaterial = new THREE.MeshStandardMaterial({
    color: 0xcccccc, // Light gray
    metalness: 0.6,
    roughness: 0.4,
  });

  // Main horizontal track
  const horizontalTrackGeometry = new THREE.BoxGeometry(
    roomWidth - 1,
    0.1,
    0.2,
  );
  const horizontalTrack = new THREE.Mesh(
    horizontalTrackGeometry,
    trackMaterial,
  );
  horizontalTrack.position.set(0, roomHeight / 2 - 0.15, 0); // Corrected Y position
  scene.add(horizontalTrack);

  // Cross tracks for front and back spotlights
  const crossTrackGeometry = new THREE.BoxGeometry(0.2, 0.1, roomLength - 1);
  const frontTrack = new THREE.Mesh(crossTrackGeometry, trackMaterial);
  frontTrack.position.set(0, roomHeight / 2 - 0.15, 0); // Corrected Y position
  scene.add(frontTrack);

  // Add track connectors at intersections
  const connectorGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.15, 16);
  const connectorMaterial = new THREE.MeshStandardMaterial({
    color: 0x303030,
    metalness: 0.9,
    roughness: 0.1,
  });
  const connector = new THREE.Mesh(connectorGeometry, connectorMaterial);
  connector.rotation.x = Math.PI / 2;
  connector.position.set(0, roomHeight / 2 - 0.15, 0); // Corrected Y position
  scene.add(connector);

  // Define positions for the spotlights relative to the center, near the ceiling
  const lightPositions = [
    // Near Left wall artwork
    { x: -roomWidth / 2 + 1.5, z: roomLength / 3 },
    // Near Right wall artwork
    { x: roomWidth / 2 - 1.5, z: -roomLength / 3 },
    // Near Back wall artwork
    { x: 0, z: -roomLength / 2 + 1.5 },
    // Near Front wall artwork
    { x: 0, z: roomLength / 2 - 1.5 },
    // Add more positions here if needed for extra lights
  ];

  // Get artwork positions for targeting spotlights
  const artworkTargetPositions = [
    {
      pos: [-roomWidth / 2 + 0.05, 2.5, roomLength / 3],
      rot: new THREE.Euler(0, Math.PI / 2, 0),
    }, // Left
    {
      pos: [roomWidth / 2 - 0.05, 2.5, -roomLength / 3],
      rot: new THREE.Euler(0, -Math.PI / 2, 0),
    }, // Right
    { pos: [0, 2.5, -roomLength / 2 + 0.05], rot: new THREE.Euler(0, 0, 0) }, // Back
    {
      pos: [0, 2.5, roomLength / 2 - 0.05],
      rot: new THREE.Euler(0, Math.PI, 0),
    }, // Front
  ];

  lightPositions.forEach((lightPos, index) => {
    const lightY = roomHeight / 2 - 0.2; // Corrected Y position for lights/housings
    // Create spotlight housing (white cylinder)
    const housingGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 16);
    const housingMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff, // White
      metalness: 0.5,
      roughness: 0.5,
    });
    const housing = new THREE.Mesh(housingGeometry, housingMaterial);
    housing.position.set(lightPos.x, lightY, lightPos.z); // Use corrected Y and lightPos
    housing.rotation.x = Math.PI / 2; // Point cylinder downward
    scene.add(housing);

    // Create spotlight
    const spotLight = new THREE.SpotLight(0xffffff, 3.5); // Increased intensity
    spotLight.position.set(lightPos.x, lightY, lightPos.z); // Use corrected Y and lightPos

    // Target the corresponding artwork (ensure arrays match length or handle index)
    if (index < artworkTargetPositions.length) {
      const artTargetPos = artworkTargetPositions[index].pos;
      const target = new THREE.Object3D();
      target.position.set(artTargetPos[0], artTargetPos[1], artTargetPos[2]); // Target the artwork's position
      scene.add(target);
      spotLight.target = target;
    } else {
      // Default target if no corresponding artwork (e.g., point downwards)
      const target = new THREE.Object3D();
      target.position.set(lightPos.x, 0, lightPos.z); // Point towards floor below light
      scene.add(target);
      spotLight.target = target;
    }

    // Configure spotlight for softer, wider museum lighting
    spotLight.angle = Math.PI / 8; // Wider beam
    spotLight.penumbra = 0.3; // Softer edges
    spotLight.decay = 1.5; // Adjusted decay
    spotLight.distance = 8; // Adjusted distance
    spotLight.castShadow = true;
    spotLight.power = 40;

    // Adjusted shadow settings for mobile
    spotLight.shadow.mapSize.width = 512; // Reduced shadow map size
    spotLight.shadow.mapSize.height = 512; // Reduced shadow map size
    spotLight.shadow.camera.near = 0.1;
    spotLight.shadow.camera.far = 10;
    spotLight.shadow.focus = 1;
    spotLight.shadow.bias = -0.0001;

    scene.add(spotLight);
  });
}

function addArtwork(artworkManager) {
  const artworkData = [
    {
      imagePath: "/assets/images/1.JPG",
      position: new THREE.Vector3(-roomWidth / 2 + 0.05, 3.0, roomLength / 3), // Raised Y position
      rotation: new THREE.Euler(0, Math.PI / 2, 0),
      metadata: {
        title: "",
        artist: "",
        sequence: "V / V",
        sequenceIndex: 5,
        isFinalArtwork: true,
        description:
          "She gazes through the golden circle and finds a stranger wearing her own face — half shadow, half light, one eye open to what was, the other closed to what will never be.",
        year: "",
        spotlight: true,
        spotlightColor: 0xffffff,
        frame: true,
      },
    },
    {
      imagePath: "/assets/images/2.JPG",
      position: new THREE.Vector3(roomWidth / 2 - 0.05, 3.0, -roomLength / 3), // Raised Y position
      rotation: new THREE.Euler(0, -Math.PI / 2, 0),
      metadata: {
        title: "",
        artist: "",
        sequence: "III / V",
        sequenceIndex: 3,
        description:
          "Between the gilded frame and the mosaic world behind her, she speaks without words to the one who knows all her secret names. The orbs in her hair are planets she has swallowed.",
        year: "",
        spotlight: true,
        spotlightColor: 0xffffff,
        frame: true,
      },
    },
    {
      imagePath: "/assets/images/5.JPG",
      position: new THREE.Vector3(0, 3.0, -roomLength / 2 + 0.05), // Raised Y position
      rotation: new THREE.Euler(0, 0, 0),
      metadata: {
        title: "",
        artist: "",
        sequence: "II / V",
        sequenceIndex: 2,
        description:
          "From the deep spiral she was born. Her reflection unravels in golden waves, caught between the eye that sees and the abyss that watches back.",
        year: "",
        spotlight: true,
        spotlightColor: 0xffffff,
        frame: true,
      },
    },
    {
      imagePath: "/assets/images/4.JPG",
      position: new THREE.Vector3(0, 3.0, roomLength / 2 - 0.05), // Raised Y position
      rotation: new THREE.Euler(0, Math.PI, 0),
      metadata: {
        title: "",
        artist: "",
        sequence: "IV / V",
        sequenceIndex: 4,
        description:
          "She carries a garden of remembered lives upon her head, yet the glass shows only silence — a face unwritten, a self not yet spoken into being.",
        year: "",
        spotlight: true,
        spotlightColor: 0xffffff,
        frame: true,
      },
    },
    {
      imagePath: "/assets/images/3.JPG",
      position: new THREE.Vector3(0, 3.5, 0), // Raised Y position
      rotation: new THREE.Euler(0, 0, 0),
      metadata: {
        title: "",
        artist: "",
        sequence: "I / V",
        sequenceIndex: 1,
        description:
          "Born of the same starlight, they meet at the edge of the world that splits all things in two — not mirror and woman, but dream and dreamer, eternal and indivisible.",
        year: "",
        spotlight: true,
        spotlightColor: 0xffffff,
        frame: true,
      },
    },
  ];

  artworkData.forEach((data) => {
    artworkManager.loadArtwork(
      data.imagePath,
      data.position,
      data.rotation,
      new THREE.Vector3(artWidth, artHeight, 1), // Scale
      data.metadata,
    );
  });
}

export { createRoom, addArtwork };
