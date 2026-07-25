import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";

/** Minimal Asphalt-Comic placeholder scene (scaffold). */
export function createRaceScene(canvas: HTMLCanvasElement) {
  const scene = new Scene();
  scene.background = new Color(0x5ba3d9);

  const camera = new PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(0, 6, 12);
  camera.lookAt(0, 0, 0);

  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const ambient = new AmbientLight(0xffffff, 0.7);
  const sun = new DirectionalLight(0xffffff, 0.85);
  sun.position.set(5, 12, 4);
  scene.add(ambient, sun);

  const asphalt = new Mesh(
    new BoxGeometry(24, 0.2, 16),
    new MeshLambertMaterial({ color: 0x4a4f57 }),
  );
  asphalt.position.y = -0.1;
  scene.add(asphalt);

  const grassLeft = new Mesh(
    new BoxGeometry(3, 0.15, 16),
    new MeshLambertMaterial({ color: 0x3f8f3a }),
  );
  grassLeft.position.set(-13.5, -0.05, 0);
  scene.add(grassLeft);

  const grassRight = grassLeft.clone();
  grassRight.position.x = 13.5;
  scene.add(grassRight);

  const car = new Mesh(
    new BoxGeometry(1.2, 0.55, 2.2),
    new MeshLambertMaterial({ color: 0xe03131 }),
  );
  car.position.set(0, 0.35, 0);
  scene.add(car);

  function resize(): void {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  window.addEventListener("resize", resize);
  resize();

  let last = performance.now();

  return {
    tick(now: number): void {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      car.rotation.y += dt * 0.35;
      renderer.render(scene, camera);
    },
  };
}
