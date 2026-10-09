import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertSafeBuildEnvironment,isUnsafeClientKey} from '../src/lib/clientKey.ts';
const fakeJwt=(role:string)=>'test.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.test';
test('privileged and secret keys are rejected during browser client initialization',()=>{assert.equal(isUnsafeClientKey('sb_secret_synthetic-fixture'),true);assert.equal(isUnsafeClientKey(fakeJwt('service_role')),true);assert.equal(isUnsafeClientKey(fakeJwt('authenticated')),true);});
test('publishable and legacy anonymous keys are allowed but damaged keys fail closed',()=>{assert.equal(isUnsafeClientKey('sb_publishable_synthetic-fixture'),false);assert.equal(isUnsafeClientKey(fakeJwt('anon')),false);assert.equal(isUnsafeClientKey('broken.jwt.key'),true);assert.equal(isUnsafeClientKey('opaque-secret'),true);});

test('build configuration refuses privileged credentials before generating assets',()=>{assert.throws(()=>assertSafeBuildEnvironment({VITE_SUPABASE_ANON_KEY:'sb_secret_synthetic-fixture'}));assert.throws(()=>assertSafeBuildEnvironment({VITE_SERVICE_ROLE_KEY:'synthetic-fixture'}));assert.doesNotThrow(()=>assertSafeBuildEnvironment({VITE_SUPABASE_ANON_KEY:fakeJwt('anon')}));});
