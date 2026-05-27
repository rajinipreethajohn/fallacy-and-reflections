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

  // Add a new artwork to the collection
  addArtwork(mesh, title, artist, description, year) {
    this.artworks.push({
      mesh,
      info: {
        title,
        artist,
        description,
        year,
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
      this.artworkTitle.style.display = "none";
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
  }

  // Hide artwork information panel
  hideArtworkInfo() {
    this.infoPanel.style.display = "none";
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
  }
}
