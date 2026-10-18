import * as THREE from "three";

// 仅校准当前 test.glb；偏移在镜像后的头部坐标系中，+X 朝画面右侧，+Y 朝上。
// GLB 自带的节点旋转保留；在其基础上放平 15°，不修改几何、纹理或 UV。
export const HAIR_CLIP_CALIBRATION = Object.freeze({
    localOffset: Object.freeze([0.04, 0.05, 0]),
    localRotationDegrees: Object.freeze([0, 0, -15]),
    baseScale: 1,
    baseEyeDistance: 0.176,
    depthScale: 0.8,
    depthReference: 0.5,
    positionStep: 0.005
});

export const DEFAULT_HAIR_CLIP_ADJUSTMENT = Object.freeze({
    size: 100, position: 0, rotation: 0
});

export function getHairClipCalibratedPose(temple, headQuaternion, distanceScale, camera,
    adjustment = DEFAULT_HAIR_CLIP_ADJUSTMENT) {
    const calibration = HAIR_CLIP_CALIBRATION;
    camera.updateMatrixWorld(true);
    const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
    // 视频已由 CSS 镜像，Three 画布未镜像：只在地标映射这里反转 X。
    const rayPoint = new THREE.Vector3(1 - temple.x * 2, 1 - temple.y * 2, 0.5)
        .unproject(camera);
    const direction = rayPoint.sub(cameraPosition).normalize();
    const depth = -(temple.z - calibration.depthReference) * calibration.depthScale;
    const rayDistance = (depth - cameraPosition.z) / direction.z;
    const anchor = cameraPosition.clone().addScaledVector(direction, rayDistance);

    // 先缩放头部局部偏移，再随头部旋转；大小滑杆不改变佩戴锚点。
    const localOffset = new THREE.Vector3().fromArray(calibration.localOffset);
    localOffset.x += adjustment.position * calibration.positionStep;
    localOffset.multiplyScalar(distanceScale).applyQuaternion(headQuaternion);
    const localRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        ...calibration.localRotationDegrees.map(THREE.MathUtils.degToRad)
    ));
    const userRotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(adjustment.rotation)
    );
    return {
        anchor,
        position: anchor.clone().add(localOffset),
        quaternion: headQuaternion.clone().multiply(localRotation).multiply(userRotation),
        scale: calibration.baseScale * distanceScale * adjustment.size / 100
    };
}
