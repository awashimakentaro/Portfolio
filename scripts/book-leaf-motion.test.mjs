import test from 'node:test';
import assert from 'node:assert/strict';
import { leafPose } from '../src/lib/book-leaf-motion.mjs';

test('both resting poses are flat and every sampled turning pose stays finite', () => {
  for (const p of [0,1]) {
    const pose=leafPose(p);
    assert.ok(Math.abs(pose.root+Math.PI*p)<1e-10);
    for(const joint of pose.joints) for(const angle of Object.values(joint))assert.ok(Math.abs(angle)<1e-10);
  }
  for(let p=0;p<=1;p+=.01) {
    const pose=leafPose(p,.02);
    assert.equal(pose.joints.length,24);
    assert.ok(Number.isFinite(pose.root));
    for(const joint of pose.joints)for(const angle of Object.values(joint))assert.ok(Number.isFinite(angle)&&Math.abs(angle)<.3);
  }
});
test('the sheet bows around its middle and its tip trails the hinge', () => {
  const normal=leafPose(.5), lagged=leafPose(.5,.07);
  assert.ok(normal.joints.slice(0,12).reduce((sum,joint)=>sum+joint.y,0)>.9);
  assert.ok(normal.joints.slice(12).reduce((sum,joint)=>sum+joint.y,0)<-.9);
  assert.ok(lagged.joints.reduce((sum,joint)=>sum+joint.y,0)>normal.joints.reduce((sum,joint)=>sum+joint.y,0));
});
