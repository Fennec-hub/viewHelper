import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Camera,
  CanvasTexture,
  Clock,
  Color,
  Euler,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  RepeatWrapping,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const [POS_X, POS_Y, POS_Z, NEG_X, NEG_Y, NEG_Z] = Array(6)
  .fill(0)
  .map((_, i) => i);

const axesColors = [
  new Color(0xff3653),
  new Color(0x8adb00),
  new Color(0x2c8fff),
];

const clock = new Clock();
const targetPosition = new Vector3();
const targetQuaternion = new Quaternion();
const euler = new Euler();
const q1 = new Quaternion();
const q2 = new Quaternion();
const viewport = new Vector4();
const point = new Vector3();
const dim = 128;
const turnRate = 2 * Math.PI; // turn rate in angles per second
const raycaster = new Raycaster();
const mouse = new Vector2();
const mouseStart = new Vector2();
const mouseDelta = new Vector2();
const dummy = new Object3D();
const dummyGimbal = new Object3D();
const dummyCamera = new Object3D();
let radius = 0;

dummyGimbal.add(dummyCamera);

class ViewHelper extends Object3D {
  constructor(
    camera,
    renderer,
    controls = null,
    position = "bottomRight",
    size = 128
  ) {
    super();

    dragging = false;
    orthoCamera = new OrthographicCamera(-1.8, 1.8, 1.8, -1.8, 0, 4);
    isViewHelper = true;
    animating = false;
    center = new Vector3();

    this.renderer = renderer;
    this.camera = camera;
    this.domElement = renderer.domElement;

    this.orthoCamera.position.set(0, 0, 2);

    this.backgroundSphere = getBackgroundSphere();
    this.axesLines = getAxesLines();
    this.spritePoints = getAxesSpritePoints();

    this.add(this.backgroundSphere, this.axesLines, ...this.spritePoints);

    this.domContainer = getDomEventContainer(position, size);
    // FIXME
    // This may cause confusion if the parent isn't the body and doesn't have a `position:relative`
    this.domElement.parentElementappendChild(this.domContainer);

    this.domRect = this.domContainer.getBoundingClientRect();
    this.startListening();

    renderer.getViewport(viewport);

    if (controls) {
      controls.addEventListener("change", () => this.update());
      this.center = controls.center ? controls.center : this.center;
    }
  }

  startListening() {
    this.domContainer.onpointerdown = (e) => this.onPointerDown(e);
    this.domContainer.onpointermove = (e) => this.onPointerMove(e);
    this.domContainer.onpointerleave = () => this.onPointerLeave();
  }

  onPointerDown(e) {
    const drag = (e) => {
      if (!this.dragging && isClick(e, mouseStart)) return;
      this.dragging = true;

      mouseDelta
        .set(e.clientX, e.clientY)
        .sub(mouseStart)
        .multiplyScalar((1 / this.domRect.width) * Math.PI);

      this.rotation.y = rotationStart.x + mouseDelta.x;
      this.rotation.x = rotationStart.y + mouseDelta.y;
      this.updateMatrixWorld();

      dummyGimbal.rotation.copy(this.rotation);
      dummyGimbal.updateMatrixWorld();
      dummyCamera.updateMatrixWorld();

      dummyCamera.getWorldPosition(this.camera.position);
      this.camera.lookAt(this.center);

      this.update(false);
    };
    const endDrag = () => {
      document.removeEventListener("pointermove", drag, false);
      document.removeEventListener("pointerup", endDrag, false);

      if (!this.dragging) {
        this.handleClick(e);
        return;
      }

      this.dragging = false;
    };

    if (this.animating === true) return;
    e.preventDefault();

    mouseStart.set(e.clientX, e.clientY);

    dummyGimbal.position.copy(this.center);
    dummyGimbal.updateMatrixWorld();
    dummyCamera.position.copy(this.camera.position);
    dummyCamera.updateMatrixWorld();

    const rotationStart = euler.copy(this.rotation);

    document.addEventListener("pointermove", drag, false);
    document.addEventListener("pointerup", endDrag, false);
  }

  onPointerMove(e) {
    if (this.dragging) return;
    this.backgroundSphere.material.opacity = 0.2;
    this.handleHover(e);
  }

  onPointerLeave() {
    if (this.dragging) return;
    this.backgroundSphere.material.opacity = 0;
    resetSpritesColor(this.spritePoints);
    this.domContainer.style.cursor = "";
  }

  handleClick(e) {
    const object = getIntersectionObject(
      e,
      this.domRect,
      this.orthoCamera,
      this.spritePoints
    );

    if (!object) return;

    prepareAnimationData(this.camera, object, this.center);

    this.animating = true;
  }

  handleHover(e) {
    const object = getIntersectionObject(
      e,
      this.domRect,
      this.orthoCamera,
      this.spritePoints
    );
    if (!object) {
      this.domContainer.style.cursor = "";
      resetSpritesColor(this.spritePoints);
      return;
    }

    resetSpritesColor(this.spritePoints);
    object.material.mapoffset.x = 0.5;
    this.domContainer.style.cursor = "pointer";
  }

  render() {
    const delta = clock.getDelta();
    if (this.animating) this.animate(delta);

    const x = this.domRect.left;
    const y = this.domElement.offsetHeight - this.domRect.bottom;

    this.renderer.clearDepth();
    this.renderer.setViewport(x, y, dim, dim);

    this.renderer.render(this, this.orthoCamera);

    this.renderer.setViewport(viewport);
  }

  update(fromCamera = true) {
    if (fromCamera) {
      this.quaternion.copy(this.camera.quaternion).invert();
      this.updateMatrixWorld();
    }

    setSpritesOpacity(this.spritePoints, this.camera);
  }

  animate(delta) {
    const step = delta * turnRate;

    // animate position by doing a slerp and then scaling the position on the unit sphere

    q1.rotateTowards(q2, step);
    this.camera.position
      .set(0, 0, 1)
      .applyQuaternion(q1)
      .multiplyScalar(radius)
      .add(this.center);

    // animate orientation

    this.camera.quaternion.rotateTowards(targetQuaternion, step);

    this.update();

    if (q1.angleTo(q2) === 0) {
      this.animating = false;
    }
  }

  dispose() {
    this.axesLines.geometry.dispose();
    this.axesLines.material.dispose();

    this.backgroundSphere.geometry.dispose();
    this.backgroundSphere.material.dispose();

    this.spritePoints.forEach((sprite) => {
      sprite.material.mapdispose();
      sprite.material.dispose();
    });

    this.domContainer.remove();
  }
}

function getDomEventContainer(position, size) {
  const div = document.createElement("div");
  //div.id = "viewHelper";
  div.style.position = "absolute";

  switch (position) {
    case "topLeft":
      div.style.top = "0";
      div.style.left = "0";
      break;
    case "topRight":
      div.style.top = "0";
      div.style.right = "0";
      break;
    case "bottomLeft":
      div.style.bottom = "0";
      div.style.left = "0";
      break;

    default:
      div.style.bottom = "0";
      div.style.right = "0";
      break;
  }

  div.style.height = `${size}px`;
  div.style.width = `${size}px`;
  div.style.borderRadius = "100%";

  return div;
}

function getAxesLines() {
  const distance = 0.9;
  const position = Array(3)
    .fill(0)
    .map((_, i) => [
      !i ? distance : 0,
      i == 1 ? distance : 0,
      i == 2 ? distance : 0,
      0,
      0,
      0,
    ])
    .flat();
  const color = Array(6)
    .fill(0)
    .map((_, i) =>
      i < 2
        ? axesColors[0].toArray()
        : i < 4
        ? axesColors[1].toArray()
        : axesColors[2].toArray()
    )
    .flat();

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(position), 3)
  );
  geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(color), 3)
  );

  return new LineSegments(
    geometry,
    new LineBasicMaterial({
      linewidth: 3,
      vertexColors: true,
    })
  );
}

function getBackgroundSphere() {
  const geometry = new SphereGeometry(1.6);
  const sphere = new Mesh(
    geometry,
    new MeshBasicMaterial({
      color: 0xffffff,
      //side: BackSide,
      transparent: true,
      opacity: 0,
      depthTest: false,
    })
  );

  return sphere;
}

function getAxesSpritePoints() {
  const axes = ["X", "Y", "Z"];
  return Array(6)
    .fill(0)
    .map((_, i) => {
      const isPositive = i < 3;
      const sign = isPositive ? "pos" : "neg";
      const axis = axes[i % 3];
      const color = axesColors[i % 3];

      const sprite = new Sprite(
        getSpriteMaterial(color, isPositive ? axis : null)
      );
      sprite.userData.type = `${sign}${axis}`;
      sprite.scale.setScalar(isPositive ? 0.6 : 0.4);
      sprite.position[axis.toLowerCase()] = isPositive ? 1.2 : -1.2;

      return sprite;
    });
}

function getSpriteMaterial(color, text = null) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;

  const context = canvas.getContext("2d");
  context.beginPath();
  context.arc(32, 32, 32, 0, 2 * Math.PI);
  context.closePath();
  context.fillStyle = color.getStyle();
  context.fill();

  context.beginPath();
  context.arc(96, 32, 32, 0, 2 * Math.PI);
  context.closePath();
  context.fillStyle = "#FFF";
  context.fill();

  if (text !== null) {
    context.font = "bold 48px Arial";
    context.textAlign = "center";
    context.fillStyle = "#000";
    context.fillText(text, 32, 48);
    context.fillText(text, 96, 48);
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.x = 0.5;

  return new SpriteMaterial({ map: texture, toneMapped: false });
}

function prepareAnimationData(camera, object, focusPoint) {
  switch (object.userData.type) {
    case "posX":
      targetPosition.set(1, 0, 0);
      targetQuaternion.setFromEuler(new Euler(0, Math.PI * 0.5, 0));
      break;

    case "posY":
      targetPosition.set(0, 1, 0);
      targetQuaternion.setFromEuler(new Euler(-Math.PI * 0.5, 0, 0));
      break;

    case "posZ":
      targetPosition.set(0, 0, 1);
      targetQuaternion.setFromEuler(new Euler());
      break;

    case "negX":
      targetPosition.set(-1, 0, 0);
      targetQuaternion.setFromEuler(new Euler(0, -Math.PI * 0.5, 0));
      break;

    case "negY":
      targetPosition.set(0, -1, 0);
      targetQuaternion.setFromEuler(new Euler(Math.PI * 0.5, 0, 0));
      break;

    case "negZ":
      targetPosition.set(0, 0, -1);
      targetQuaternion.setFromEuler(new Euler(0, Math.PI, 0));
      break;

    default:
      console.error("ViewHelper: Invalid axis.");
  }

  setRadius(camera, focusPoint);
  prepareQuaternions(camera, focusPoint);
}

function setRadius(camera, focusPoint) {
  radius = camera.position.distanceTo(focusPoint);
}

function prepareQuaternions(camera, focusPoint) {
  targetPosition.multiplyScalar(radius).add(focusPoint);

  dummy.position.copy(focusPoint);

  dummy.lookAt(camera.position);
  q1.copy(dummy.quaternion);

  dummy.lookAt(targetPosition);
  q2.copy(dummy.quaternion);
}

function updatePointer(e, domRect, orthoCamera) {
  mouse.x = ((e.clientX - domRect.left) / domRect.width) * 2 - 1;
  mouse.y = -((e.clientY - domRect.top) / domRect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, orthoCamera);
}

function isClick(e, startCoords, threshold = 10) {
  return (
    Math.abs(e.clientX - startCoords.x) < threshold &&
    Math.abs(e.clientY - startCoords.y) < threshold
  );
}

function getIntersectionObject(
  event,
  domRect,
  orthoCamera,
  intersectionObjects
) {
  updatePointer(event, domRect, orthoCamera);

  const intersects = raycaster.intersectObjects(intersectionObjects);

  if (!intersects.length) return null;

  const intersection = intersects[0];
  return intersection.object;
}

function resetSpritesColor(sprites) {
  sprites.forEach((sprite) => (sprite.material.mapoffset.x = 1));
}

function setSpritesOpacity(sprites, camera) {
  point.set(0, 0, 1);
  point.applyQuaternion(camera.quaternion);

  if (point.x >= 0) {
    sprites[POS_X].material.opacity = 1;
    sprites[NEG_X].material.opacity = 0.5;
  } else {
    sprites[POS_X].material.opacity = 0.5;
    sprites[NEG_X].material.opacity = 1;
  }

  if (point.y >= 0) {
    sprites[POS_Y].material.opacity = 1;
    sprites[NEG_Y].material.opacity = 0.5;
  } else {
    sprites[POS_Y].material.opacity = 0.5;
    sprites[NEG_Y].material.opacity = 1;
  }

  if (point.z >= 0) {
    sprites[POS_Z].material.opacity = 1;
    sprites[NEG_Z].material.opacity = 0.5;
  } else {
    sprites[POS_Z].material.opacity = 0.5;
    sprites[NEG_Z].material.opacity = 1;
  }
}

export { ViewHelper };
