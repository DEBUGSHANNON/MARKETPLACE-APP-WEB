import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowUpRight,
  Asterisk,
  ChevronDown,
  ChevronUp,
  Grid,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { Listing, ListingCategory } from '../types/marketplace';
import { formatMYR, resolveAssetUrl } from '../data/utmCatalog';
import { OriginRect } from './SphereObjectModal';

interface OrbitSphereProps {
  listings: Listing[];
  loading?: boolean;
  slowLatency?: boolean;
  syncError?: string | null;
  onRetrySync?: () => void;
  onSelectListing: (listing: Listing, originRect?: OriginRect) => void;
  onOpenCatalog: () => void;
  onOpenCreateModal: () => void;
  isPaused?: boolean;
}

const SPHERE_CATEGORIES: Array<'All' | ListingCategory> = [
  'All',
  'Electronics',
  'Books',
  'Mobility',
  'Lifestyle',
];

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _origin = new THREE.Vector3(0, 0, 0);

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createCurvedCardGeometry(width: number, height: number): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(width, height, 12, 10);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const curveZ = -((x * x) * 0.056 + (y * y) * 0.038);
    pos.setZ(i, curveZ);
  }
  geo.computeVertexNormals();
  return geo;
}

function drawCardCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  listing: Listing,
  img?: HTMLImageElement,
) {
  ctx.clearRect(0, 0, w, h);

  // Rounded outer frame
  const radius = 32;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, radius);
  ctx.clip();

  // Warm alabaster archival frame backing
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  // Inner photo rect
  const pad = 14;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, innerW, innerH, 22);
  ctx.clip();

  if (img && img.complete && img.naturalWidth > 0) {
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const boxRatio = innerW / innerH;
    let drawW = innerW;
    let drawH = innerH;
    let drawX = pad;
    let drawY = pad;
    if (imgRatio > boxRatio) {
      drawW = innerH * imgRatio;
      drawX = pad - (drawW - innerW) / 2;
    } else {
      drawH = innerW / imgRatio;
      drawY = pad - (drawH - innerH) / 2;
    }
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  } else {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#E3ECE0');
    grad.addColorStop(1, '#CBDCCB');
    ctx.fillStyle = grad;
    ctx.fillRect(pad, pad, innerW, innerH);
    ctx.fillStyle = '#0A462C';
    ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(listing.category, w / 2, h / 2);
  }

  // Rich bottom gradient scrim with title, MYR price, and UTM zone
  const scrim = ctx.createLinearGradient(0, h - 134, 0, h - pad);
  scrim.addColorStop(0, 'rgba(10, 26, 17, 0)');
  scrim.addColorStop(0.55, 'rgba(10, 26, 17, 0.48)');
  scrim.addColorStop(1, 'rgba(10, 26, 17, 0.82)');
  ctx.fillStyle = scrim;
  ctx.fillRect(pad, h - 134, innerW, 134 - pad);

  // Item title above price
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  const shortTitle =
    listing.title.length > 28 ? `${listing.title.slice(0, 27)}…` : listing.title;
  ctx.fillText(shortTitle, pad + 18, h - pad - 44);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 22px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(formatMYR(listing.price), pad + 18, h - pad - 16);

  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'right';
  const shortZone = listing.campusZone.split('(')[0].trim().slice(0, 18);
  ctx.fillText(shortZone, w - pad - 18, h - pad - 17);

  ctx.restore();
  ctx.restore();

  // Crisp outer hairline frame
  ctx.strokeStyle = 'rgba(10, 70, 44, 0.16)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(1.5, 1.5, w - 3, h - 3, radius);
  ctx.stroke();
}

function getMeshScreenRect(
  mesh: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
): OriginRect {
  mesh.updateWorldMatrix(true, false);
  const box = canvas.getBoundingClientRect();
  const hw = 1.74 / 2;
  const hh = 1.32 / 2;
  const corners = [
    new THREE.Vector3(-hw, -hh, 0),
    new THREE.Vector3(hw, -hh, 0),
    new THREE.Vector3(hw, hh, 0),
    new THREE.Vector3(-hw, hh, 0),
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    c.applyMatrix4(mesh.matrixWorld).project(camera);
    const px = box.left + (c.x * 0.5 + 0.5) * box.width;
    const py = box.top + (-c.y * 0.5 + 0.5) * box.height;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  return {
    left: minX,
    top: minY,
    width: Math.max(48, maxX - minX),
    height: Math.max(36, maxY - minY),
  };
}

export const OrbitSphere: React.FC<OrbitSphereProps> = ({
  listings,
  loading = false,
  slowLatency = false,
  syncError = null,
  onRetrySync,
  onSelectListing,
  onOpenCatalog,
  onOpenCreateModal,
  isPaused = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<'All' | ListingCategory>('All');
  const [autoSpin, setAutoSpin] = useState(true);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [hoveredListing, setHoveredListing] = useState<Listing | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const autoSpinRef = useRef(autoSpin);
  const isPausedRef = useRef(isPaused);
  const onSelectRef = useRef(onSelectListing);
  const resetSignalRef = useRef<(() => void) | null>(null);
  const spotlightSignalRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    autoSpinRef.current = autoSpin;
  }, [autoSpin]);

  useEffect(() => {
    isPausedRef.current = isPaused;
    if (isPaused) {
      setHoveredListing(null);
    }
  }, [isPaused]);

  useEffect(() => {
    onSelectRef.current = onSelectListing;
  }, [onSelectListing]);

  const filteredListings = useMemo(() => {
    const availableFirst = [...listings].sort((a, b) => {
      if (a.status === 'available' && b.status !== 'available') return -1;
      if (a.status !== 'available' && b.status === 'available') return 1;
      return 0;
    });
    if (selectedCategory === 'All') return availableFirst;
    const subset = availableFirst.filter((item) => item.category === selectedCategory);
    return subset.length > 0 ? subset : availableFirst;
  }, [listings, selectedCategory]);

  // Populate 20 curved photo cards evenly on the Fibonacci sphere
  const sphereItems = useMemo(() => {
    if (filteredListings.length === 0) return [];
    const totalSlots = 20;
    return Array.from({ length: totalSlots }, (_, idx) => ({
      slotIndex: idx,
      listing: filteredListings[idx % filteredListings.length],
    }));
  }, [filteredListings]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setWebglUnavailable(true);
      return;
    }

    const isSoftwareGl = detectSoftwareGl();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));

    const rect = container.getBoundingClientRect();
    const initWidth = Math.max(rect.width, 320);
    const initHeight = Math.max(rect.height, 420);
    renderer.setSize(initWidth, initHeight);

    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    container.replaceChildren(canvas);

    const scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const computeBaseCamZ = (w: number, h: number) => {
      const aspect = Math.max(w / Math.max(h, 1), 0.42);
      const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(42 / 2));
      const fitZ = 5.15 / (tanHalfFov * aspect);
      return Math.max(9.6, Math.min(23.5, fitZ));
    };

    const camera = new THREE.PerspectiveCamera(42, initWidth / initHeight, 0.1, 100);
    let baseCamZ = computeBaseCamZ(initWidth, initHeight);
    camera.position.set(0, 0.06, baseCamZ);

    // Balanced 3-point studio lighting
    const hemiLight = new THREE.HemisphereLight(0xf6f8f4, 0xd8ded5, 1.4);
    scene.add(hemiLight);
    const keyLight = new THREE.DirectionalLight(0xfffaf0, 1.3);
    keyLight.position.set(6, 8, 9);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xd2e7d6, 0.72);
    rimLight.position.set(-7, -4, -6);
    scene.add(rimLight);

    // Sphere root group (starts slightly scaled for lively entrance pulse)
    const sphereGroup = new THREE.Group();
    sphereGroup.scale.setScalar(0.92);
    scene.add(sphereGroup);

    // Subtle architectural meridian wireframe inside sphere
    const cageGeo = new THREE.SphereGeometry(3.48, 22, 16);
    const cageMat = new THREE.MeshBasicMaterial({
      color: 0x0a462c,
      wireframe: true,
      transparent: true,
      opacity: 0.05,
    });
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    sphereGroup.add(cageMesh);

    // Outer orbital guide rings for depth & motion
    const ringGeoA = new THREE.TorusGeometry(4.92, 0.008, 8, 96);
    const ringMatA = new THREE.MeshBasicMaterial({
      color: 0x0a462c,
      transparent: true,
      opacity: 0.09,
    });
    const orbitalRingA = new THREE.Mesh(ringGeoA, ringMatA);
    orbitalRingA.rotation.set(Math.PI * 0.38, Math.PI * 0.14, 0);
    scene.add(orbitalRingA);

    const ringGeoB = new THREE.TorusGeometry(4.65, 0.006, 8, 96);
    const ringMatB = new THREE.MeshBasicMaterial({
      color: 0x0a462c,
      transparent: true,
      opacity: 0.06,
    });
    const orbitalRingB = new THREE.Mesh(ringGeoB, ringMatB);
    orbitalRingB.rotation.set(-Math.PI * 0.28, -Math.PI * 0.22, 0);
    scene.add(orbitalRingB);

    const cardGeo = createCurvedCardGeometry(1.74, 1.32);
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    interface CardEntry {
      mesh: THREE.Mesh;
      basePos: THREE.Vector3;
      normal: THREE.Vector3;
      hoverProgress: number;
      rippleOffset: number;
      listing: Listing;
      texture: THREE.CanvasTexture;
      material: THREE.MeshPhysicalMaterial;
    }

    const cards: CardEntry[] = [];
    const clickableMeshes: THREE.Object3D[] = [];
    const sphereRadius = 4.35;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    // Cache loaded HTMLImageElements per imageUrl to avoid duplicate loads
    const imageCache = new Map<string, HTMLImageElement>();

    sphereItems.forEach((entry, idx) => {
      const y = 1 - (idx / (sphereItems.length - 1)) * 2;
      const rAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * idx;
      const x = Math.cos(theta) * rAtY;
      const z = Math.sin(theta) * rAtY;

      const normal = new THREE.Vector3(x, y, z).normalize();
      const basePos = normal.clone().multiplyScalar(sphereRadius);

      const offscreen = document.createElement('canvas');
      offscreen.width = 640;
      offscreen.height = 480;
      const ctx = offscreen.getContext('2d')!;
      drawCardCanvas(ctx, 640, 480, entry.listing);

      const texture = new THREE.CanvasTexture(offscreen);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = maxAnisotropy;

      const material = new THREE.MeshPhysicalMaterial({
        map: texture,
        roughness: 0.28,
        metalness: 0.04,
        clearcoat: 0.35,
        clearcoatRoughness: 0.22,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(cardGeo, material);
      mesh.position.copy(basePos);
      // Orient card outward from sphere center
      _vec3A.copy(basePos).multiplyScalar(2);
      mesh.lookAt(_vec3A);
      mesh.userData = { listing: entry.listing, cardIndex: idx };

      sphereGroup.add(mesh);
      clickableMeshes.push(mesh);

      const cardEntry: CardEntry = {
        mesh,
        basePos,
        normal,
        hoverProgress: 0,
        rippleOffset: 0,
        listing: entry.listing,
        texture,
        material,
      };
      cards.push(cardEntry);

      // Load photo into CanvasTexture
      const src = resolveAssetUrl(entry.listing.imageUrl);
      if (src) {
        let img = imageCache.get(src);
        if (!img) {
          img = new Image();
          img.crossOrigin = 'anonymous';
          img.referrerPolicy = 'no-referrer';
          img.src = src;
          imageCache.set(src, img);
        }
        const paintLoaded = () => {
          drawCardCanvas(ctx, 640, 480, entry.listing, img);
          texture.needsUpdate = true;
        };
        if (img.complete && img.naturalWidth > 0) {
          paintLoaded();
        } else {
          img.addEventListener('load', paintLoaded, { once: true });
        }
      }
    });

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Interaction state
    let isDragging = false;
    let pointerDownX = 0;
    let pointerDownY = 0;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let totalDragDist = 0;
    let rotY = 0.25;
    let rotX = 0.14;
    let velY = 0;
    let velX = 0;
    let targetCamZ = baseCamZ;
    let pointerParallaxX = 0;
    let pointerParallaxY = 0;
    let hoveredIndex = -1;
    let lastRaycastTime = 0;
    let contextLost = false;
    let elapsedTime = 0;

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    resetSignalRef.current = () => {
      rotY = 0.25;
      rotX = 0.14;
      velY = 0;
      velX = 0;
      targetCamZ = baseCamZ;
      sphereGroup.scale.setScalar(0.94);
    };

    spotlightSignalRef.current = () => {
      velY = 0.085;
      velX = (Math.random() - 0.5) * 0.035;
      sphereGroup.scale.setScalar(0.96);
    };

    const updatePointerNdc = (clientX: number, clientY: number) => {
      const box = canvas.getBoundingClientRect();
      pointerNdc.x = ((clientX - box.left) / box.width) * 2 - 1;
      pointerNdc.y = -((clientY - box.top) / box.height) * 2 + 1;
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (isPausedRef.current) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      isDragging = true;
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      totalDragDist = 0;
      velY = 0;
      velX = 0;
      canvas.style.cursor = 'grabbing';
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (isPausedRef.current) return;

      // Subtle viewport parallax tracking
      const box = canvas.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) {
        const nx = ((e.clientX - box.left) / box.width - 0.5) * 2;
        const ny = ((e.clientY - box.top) / box.height - 0.5) * 2;
        pointerParallaxX = THREE.MathUtils.clamp(nx, -1, 1) * 0.42;
        pointerParallaxY = THREE.MathUtils.clamp(-ny, -1, 1) * 0.28;
      }

      if (isDragging) {
        const dx = e.clientX - lastPointerX;
        const dy = e.clientY - lastPointerY;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        totalDragDist += Math.hypot(dx, dy);

        rotY += dx * 0.0052;
        rotX = THREE.MathUtils.clamp(rotX + dy * 0.0042, -1.05, 1.05);
        velY = dx * 0.0038;
        velX = dy * 0.0028;
        return;
      }

      const now = performance.now();
      if (now - lastRaycastTime < 35) return;
      lastRaycastTime = now;

      updatePointerNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);

      if (hits.length > 0) {
        const idx = hits[0].object.userData.cardIndex as number;
        if (idx !== hoveredIndex) {
          hoveredIndex = idx;
          setHoveredListing(cards[idx]?.listing ?? null);
        }
        canvas.style.cursor = 'pointer';
      } else if (hoveredIndex !== -1) {
        hoveredIndex = -1;
        setHoveredListing(null);
        canvas.style.cursor = 'grab';
      } else {
        canvas.style.cursor = 'grab';
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      if (isPausedRef.current) return;
      const dist = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
      const tapMax = e.pointerType === 'touch' ? 14 : 7;
      const totalMax = e.pointerType === 'touch' ? 18 : 10;

      if (dist < tapMax && totalDragDist < totalMax) {
        updatePointerNdc(e.clientX, e.clientY);
        raycaster.setFromCamera(pointerNdc, camera);
        const hits = raycaster.intersectObjects(clickableMeshes, false);
        if (hits.length > 0) {
          const hitMesh = hits[0].object;
          const listing = hitMesh.userData.listing as Listing | undefined;
          if (listing) {
            const originRect = getMeshScreenRect(hitMesh, camera, canvas);
            onSelectRef.current(listing, originRect);
          }
        }
      }
      canvas.style.cursor = hoveredIndex !== -1 ? 'pointer' : 'grab';
    };

    const handlePointerLeave = () => {
      isDragging = false;
      if (hoveredIndex !== -1) {
        hoveredIndex = -1;
        setHoveredListing(null);
      }
      canvas.style.cursor = 'grab';
    };

    const handleWheel = (e: WheelEvent) => {
      if (isPausedRef.current) return;
      if (Math.abs(e.deltaY) < 2) return;
      const maxZoom = Math.max(12.6, baseCamZ + 4);
      targetCamZ = THREE.MathUtils.clamp(targetCamZ + e.deltaY * 0.003, 6.8, maxZoom);
    };

    const handleResize = () => {
      if (!container) return;
      const r = container.getBoundingClientRect();
      const w = Math.max(r.width, 320);
      const h = Math.max(r.height, 420);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      baseCamZ = computeBaseCamZ(w, h);
      targetCamZ = baseCamZ;
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
    };
    const onContextRestored = () => {
      contextLost = false;
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerLeave);
    canvas.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('resize', handleResize);
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    let frameId = 0;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (!contextLost) {
        elapsedTime += delta;
        if (!isDragging) {
          rotY += velY;
          rotX = THREE.MathUtils.clamp(rotX + velX, -1.05, 1.05);
          velY *= Math.exp(-3.6 * delta);
          velX *= Math.exp(-4.2 * delta);

          if (autoSpinRef.current && hoveredIndex === -1 && !isPausedRef.current) {
            rotY += delta * 0.16;
          }
        }

        sphereGroup.rotation.y = THREE.MathUtils.damp(sphereGroup.rotation.y, rotY, 10, delta);
        sphereGroup.rotation.x = THREE.MathUtils.damp(sphereGroup.rotation.x, rotX, 10, delta);
        const dampedScale = THREE.MathUtils.damp(sphereGroup.scale.x, 1, 9, delta);
        sphereGroup.scale.setScalar(dampedScale);

        orbitalRingA.rotation.z += delta * 0.08;
        orbitalRingB.rotation.z -= delta * 0.06;

        camera.position.x = THREE.MathUtils.damp(camera.position.x, pointerParallaxX, 5, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 0.06 + pointerParallaxY, 5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, 7, delta);

        const hoveredCard = hoveredIndex >= 0 ? cards[hoveredIndex] : null;

        // Animate ambient breathing wave, hovered spotlight lift, and neighbor ripple
        for (let i = 0; i < cards.length; i++) {
          const card = cards[i];
          const targetHover = i === hoveredIndex ? 1 : 0;
          card.hoverProgress = THREE.MathUtils.damp(card.hoverProgress, targetHover, 12, delta);

          let targetRipple = 0;
          if (hoveredCard && i !== hoveredIndex) {
            const dist = card.basePos.distanceTo(hoveredCard.basePos);
            if (dist < 3.4) {
              targetRipple = -(1 - dist / 3.4) * 0.18;
            }
          }
          card.rippleOffset = THREE.MathUtils.damp(card.rippleOffset, targetRipple, 10, delta);

          const wave = isPausedRef.current ? 0 : Math.sin(elapsedTime * 1.15 + i * 0.65) * 0.045;
          const lift = card.hoverProgress * 0.78 + card.rippleOffset + wave;
          _vec3B.copy(card.normal).multiplyScalar(lift);
          card.mesh.position.copy(card.basePos).add(_vec3B);

          const scale = 1 + card.hoverProgress * 0.22;
          card.mesh.scale.setScalar(scale);
        }

        camera.lookAt(_origin);
        renderer.render(scene, camera);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      cards.forEach((c) => {
        c.texture.dispose();
        c.material.dispose();
      });
      cardGeo.dispose();
      cageGeo.dispose();
      cageMat.dispose();
      ringGeoA.dispose();
      ringMatA.dispose();
      ringGeoB.dispose();
      ringMatB.dispose();
      envTarget.dispose();
      renderer.dispose();
    };
  }, [sphereItems]);

  return (
    <section className="relative w-full min-h-[100dvh] overflow-hidden bg-[#F3F3EE] select-none">
      {/* Subtle radial gallery studio lighting behind sphere */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 48%, rgba(255,255,255,0.88) 0%, rgba(235,238,231,0.62) 48%, rgba(230,233,225,0.96) 100%)',
        }}
      />

      {/* 3D WebGL Sphere Viewport or Graceful Reduced-Motion Fallback */}
      {!webglUnavailable ? (
        <div
          ref={mountRef}
          aria-label="Interactive 3D sphere of UTM marketplace items."
          className="relative z-10 w-full h-[100dvh] min-h-[540px]"
        />
      ) : (
        <div className="relative z-10 max-w-6xl mx-auto px-5 pt-24 md:pt-32 pb-28 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                onSelectListing(item, {
                  left: r.left,
                  top: r.top,
                  width: r.width,
                  height: r.height,
                });
              }}
              className="group text-left bg-white border border-black/10 rounded-2xl overflow-hidden hover:-translate-y-1 transition-transform cursor-pointer"
            >
              <div className="aspect-[4/3] bg-[#E3ECE0] overflow-hidden">
                <img
                  src={resolveAssetUrl(item.imageUrl)}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <p className="text-xs text-[#4A5D50]">
                  {item.category} · {item.condition}
                </p>
                <h3 className="text-base font-bold text-[#112419] mt-1 truncate">
                  {item.title}
                </h3>
                <p className="font-mono-tabular text-sm font-semibold text-[#0A462C] mt-1">
                  {formatMYR(item.price)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Top-left Editorial Headline Overlay */}
      <div className="pointer-events-none absolute top-[68px] sm:top-20 left-4 sm:left-6 md:left-12 right-4 sm:right-auto z-20 max-w-md">
        <p className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[#0A462C] mb-1.5 sm:mb-2 flex items-center gap-1.5">
          <Asterisk className="w-3.5 h-3.5 text-[#659A73]" />
          <span>Universiti Teknologi Malaysia</span>
        </p>
        <h1 className="text-2xl sm:text-4xl lg:text-[48px] font-extrabold tracking-tight leading-[1.06] text-[#0A462C]">
          Good things
          <br />
          deserve a{' '}
          <span className="font-display-serif italic font-normal text-utm-gradient">
            second life.
          </span>
        </h1>

        {syncError && onRetrySync ? (
          <div className="pointer-events-auto mt-3 inline-flex items-center gap-2 rounded-xl bg-white/95 border border-red-200 px-3 py-2 text-[11px] text-[#112419] shadow-sm">
            <WifiOff className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span className="font-medium">Live sync paused</span>
            <button
              type="button"
              onClick={onRetrySync}
              className="px-2 py-1 rounded-lg bg-[#0A462C] text-white font-semibold hover:bg-[#0E5D3B] inline-flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        ) : loading && slowLatency ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/90 border border-[#0A462C]/15 px-3 py-1.5 text-[11px] font-medium text-[#0A462C] shadow-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>Syncing live UTM listings over slow network...</span>
          </div>
        ) : null}
      </div>

      {/* Top-right Editorial Caption */}
      <div className="pointer-events-none hidden sm:block absolute top-24 md:top-20 right-6 md:right-12 z-20 text-right max-w-xs">
        <p className="text-xs font-bold text-[#0A462C]">
          Finds from fellow UTM students.
        </p>
        <p className="text-xs font-medium text-[#659A73] mt-1">
          Skudai Campus Exchange
        </p>
      </div>

      {/* Bottom-left Short Description */}
      <div className="pointer-events-none hidden lg:block absolute bottom-8 left-12 z-20 max-w-xs">
        <p className="text-xs leading-relaxed text-[#4A5D50]">
          Your student-to-student marketplace at Universiti Teknologi Malaysia.
          Buy pre-loved essentials, sell what you no longer need, and connect
          with fellow UTM students — all in one place.
        </p>
      </div>

      {/* Bottom-right Counter-Headline */}
      <div className="pointer-events-none hidden lg:block absolute bottom-8 right-12 z-20 text-right">
        <p className="font-display-serif italic text-xl md:text-2xl text-[#659A73] leading-tight">
          Something you need.
        </p>
        <p className="text-xl md:text-2xl font-extrabold tracking-tight text-[#0A462C] leading-tight">
          Someone at UTM has it.
        </p>
      </div>

      {/* Hovered Object Live Preview Banner above Bottom Dock */}
      <AnimatePresence>
        {hoveredListing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-none absolute bottom-36 md:bottom-24 left-1/2 -translate-x-1/2 z-30 bg-white/85 backdrop-blur-xl border border-white/60 rounded-2xl shadow-lg px-3.5 sm:px-4 py-2 sm:py-2.5 flex items-center gap-3 sm:gap-4 w-[calc(100%-1.5rem)] sm:w-auto max-w-md"
          >
            <img
              src={resolveAssetUrl(hoveredListing.imageUrl)}
              alt={hoveredListing.title}
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-lg object-cover shrink-0 bg-[#E3ECE0]"
            />
            <div className="min-w-0">
              <p className="text-xs text-[#4A5D50] truncate">
                {hoveredListing.category} · {hoveredListing.campusZone.split('(')[0].trim()}
              </p>
              <p className="text-sm font-bold text-[#112419] truncate">
                {hoveredListing.title}
              </p>
            </div>
            <div className="shrink-0 pl-2 border-l border-black/10 text-right">
              <p className="font-mono-tabular text-sm font-bold text-[#0A462C]">
                {formatMYR(hoveredListing.price)}
              </p>
              <p className="text-[11px] font-medium text-[#0A462C] flex items-center gap-0.5 justify-end">
                Open preview <ArrowUpRight className="w-3 h-3" />
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsible Unified Bottom Control Dock */}
      <div className="absolute bottom-[74px] md:bottom-5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center max-w-[94vw]">
        <button
          type="button"
          onClick={() => setDockCollapsed((prev) => !prev)}
          className="mb-1.5 px-3 py-1 rounded-full bg-white/65 backdrop-blur-md border border-white/60 text-[11px] font-semibold text-[#4A5D50] hover:text-[#0A462C] flex items-center gap-1 shadow-sm cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" /> Show Controls
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" /> Hide Controls
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl shadow-lg p-1.5 flex items-center gap-1.5 overflow-x-auto max-w-full">
            <div className="flex items-center gap-1 pr-2 border-r border-black/10">
              {SPHERE_CATEGORIES.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#0A462C] text-white'
                        : 'text-[#4A5D50] hover:bg-white/70 hover:text-[#112419]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setAutoSpin((prev) => !prev)}
              aria-label={autoSpin ? 'Pause orbit spin' : 'Resume orbit spin'}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#4A5D50] hover:bg-white/70 hover:text-[#112419] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {autoSpin ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{autoSpin ? 'Pause' : 'Spin'}</span>
            </button>

            <button
              type="button"
              onClick={() => spotlightSignalRef.current?.()}
              aria-label="Spin impulse"
              title="Give sphere a quick spin"
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#4A5D50] hover:bg-white/70 hover:text-[#0A462C] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => resetSignalRef.current?.()}
              aria-label="Reset sphere view"
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#4A5D50] hover:bg-white/70 hover:text-[#112419] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onOpenCatalog}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#112419] bg-white/80 hover:bg-white flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Catalog</span>
            </button>

            <button
              type="button"
              onClick={onOpenCreateModal}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#0A462C] text-white hover:bg-[#0E5D3B] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>List Item</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
