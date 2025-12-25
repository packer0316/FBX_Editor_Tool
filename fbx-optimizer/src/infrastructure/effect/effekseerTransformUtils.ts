import * as THREE from 'three';

export interface ComposeEffekseerMatrixParams {
  worldPosition: THREE.Vector3;
  worldQuaternion: THREE.Quaternion;
  worldScale: THREE.Vector3;
}

// Cocos2d-x to Three.js coordinate system conversion:
// - Cocos2d-x: Right-hand coordinate, +Z out of screen (towards viewer)
// - Three.js:  Right-hand coordinate, +Z into screen (away from viewer)
// 
// Z-axis is flipped between the two coordinate systems.
// Adjust CORRECTION_QUAT or CORRECTION_SCALE below to match Cocos2d-x visual results.
// 
// Common correction options:
// - Rotate 180° around X-axis: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0))
// - Mirror Z-axis: new THREE.Vector3(1, 1, -1)
// - Negate X & Y rotation input (handled upstream in EffectTestPanel.tsx)
// 
// Currently using identity (no correction) - adjust as needed for your project.
const CORRECTION_QUAT = new THREE.Quaternion(); // identity
const CORRECTION_SCALE = new THREE.Vector3(1, 1, 1); // identity

/**
 * Compose an Effekseer transform matrix using a single, unified correction rule.
 *
 * Rule (post-local):
 * - finalQuat = worldQuat * CORRECTION_QUAT
 * - finalScale = worldScale ⊙ CORRECTION_SCALE
 */
export function composeEffekseerMatrix(params: ComposeEffekseerMatrixParams): Float32Array {
  const finalQuat = params.worldQuaternion.clone().multiply(CORRECTION_QUAT);
  const finalScale = params.worldScale.clone().multiply(CORRECTION_SCALE);

  const matrix = new THREE.Matrix4();
  matrix.compose(params.worldPosition, finalQuat, finalScale);
  return new Float32Array(matrix.elements);
}


