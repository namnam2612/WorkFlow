import { useEffect, useRef } from 'react';
import {
  AmbientLight,
  DirectionalLight,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  PointLight,
  Scene,
  TorusGeometry,
  WebGLRenderer,
} from 'three';
import { prefersReducedMotion } from '../../lib/motion';
import { useTheme } from '../ui/useTheme';

/** Cảnh 3D đơn sắc: icosahedron khung lưới, octahedron kim loại, torus mảnh. Chỉ render khi đang hiện trên màn hình. */
export default function HeroScene({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const { theme } = useTheme();
  const applyTheme = useRef<((theme: 'dark' | 'light') => void) | null>(null);
  const themeRef = useRef(theme);

  // Đổi giao diện: chỉ đổi màu vật liệu, không dựng lại cảnh
  useEffect(() => {
    themeRef.current = theme;
    applyTheme.current?.(theme);
  }, [theme]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || prefersReducedMotion()) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // không có WebGL: bỏ qua, giao diện vẫn dùng được
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 9;

    const group = new Group();
    scene.add(group);

    const wire = new Mesh(new IcosahedronGeometry(1.9, 1), new MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.35 }));
    const metal = new Mesh(new OctahedronGeometry(0.95), new MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.85, roughness: 0.25 }));
    const ring = new Mesh(new TorusGeometry(2.7, 0.014, 12, 160), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
    ring.rotation.x = Math.PI / 2.4;
    group.add(wire, metal, ring);

    applyTheme.current = (mode) => {
      const ink = mode === 'light' ? 0x0a0a0a : 0xffffff;
      (wire.material as MeshBasicMaterial).color.setHex(ink);
      (ring.material as MeshBasicMaterial).color.setHex(ink);
      (metal.material as MeshStandardMaterial).color.setHex(mode === 'light' ? 0x2a2a2a : 0xd8d8d8);
    };
    applyTheme.current(themeRef.current);

    scene.add(new AmbientLight(0xffffff, 0.35));
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new PointLight(0xffffff, 18, 20);
    rim.position.set(-4, -2, 3);
    scene.add(rim);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const pointer = { x: 0, y: 0 };
    const onMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove);

    let frame = 0;
    let visible = true;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      wire.rotation.x += 0.0016;
      wire.rotation.y += 0.0024;
      metal.rotation.y -= 0.004;
      metal.rotation.x += 0.002;
      ring.rotation.z += 0.0018;
      group.rotation.y += (pointer.x * 0.5 - group.rotation.y) * 0.05;
      group.rotation.x += (pointer.y * 0.35 - group.rotation.x) * 0.05;
      renderer.render(scene, camera);
    };
    const setRunning = (run: boolean) => {
      cancelAnimationFrame(frame);
      if (run) frame = requestAnimationFrame(animate);
    };
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      setRunning(visible && !document.hidden);
    });
    intersection.observe(host);
    const onVisibility = () => setRunning(visible && !document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    setRunning(true);

    return () => {
      cancelAnimationFrame(frame);
      intersection.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const mesh of [wire, metal, ring]) {
        mesh.geometry.dispose();
        (mesh.material as MeshBasicMaterial | MeshStandardMaterial).dispose();
      }
      applyTheme.current = null;
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} aria-hidden className={className} />;
}
