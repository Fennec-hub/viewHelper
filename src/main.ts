import "./style.css";

import {
  Mesh,
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  MeshPhongMaterial,
  SphereGeometry,
  AxesHelper,
  DirectionalLight,
  AmbientLight,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ViewHelper } from "./ViewHelper";

let mesh: Mesh,
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  controls: OrbitControls,
  helper: ViewHelper;

init();
animate();

function init() {
  // renderer
  renderer = new WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.autoClear = false;
  document.body.appendChild(renderer.domElement);

  // scene
  scene = new Scene();

  // camera
  camera = new PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    1,
    10000
  );
  camera.position.set(20, 20, 20);

  // controls
  controls = new OrbitControls(camera, renderer.domElement);

  // ambient
  scene.add(new AmbientLight(0x222222));

  // light
  const light = new DirectionalLight(0xffffff, 1);
  light.position.set(20, 20, 0);
  scene.add(light);

  // axes
  scene.add(new AxesHelper(20));

  // geometry
  const geometry = new SphereGeometry(5, 12, 8);

  // material
  const material = new MeshPhongMaterial({
    color: 0x00ffff,
    flatShading: true,
    transparent: true,
    opacity: 0.7,
  });

  // mesh
  mesh = new Mesh(geometry, material);
  scene.add(mesh);

  // helper
  helper = new ViewHelper(camera, renderer, controls);
  helper.update();
}

function animate() {
  requestAnimationFrame(animate);

  renderer.clear();

  renderer.render(scene, camera);

  helper.render();
}
