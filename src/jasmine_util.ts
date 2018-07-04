/**
 * @license
 * Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import {ENV, Environment} from './environment';
import {Features} from './environment_util';
import {KernelBackend} from './kernels/backend';
import {MathBackendCPU} from './kernels/backend_cpu';
import {MathBackendWebGL} from './kernels/backend_webgl';

Error.stackTraceLimit = Infinity;

// Tests whether the current environment satisfies the set of constraints.
export function envSatisfiesConstraints(constraints: Features): boolean {
  for (const key in constraints) {
    const value = constraints[key as keyof Features];
    if (ENV.get(key as keyof Features) !== value) {
      return false;
    }
  }
  return true;
}

// tslint:disable-next-line:no-any
declare let __karma__: any;

function parseKarmaFlags(): void {
  const args: string[] = __karma__.config.args;
  let features: Features;
  let backend: () => KernelBackend;
  let name = '';

  args.forEach((arg, i) => {
    if (arg === '--features') {
      features = JSON.parse(args[i + 1]);
    } else if (arg === '--backend') {
      const type = args[i + 1];
      name = 'test-' + type;
      if (type.toLowerCase() === 'cpu') {
        backend = () => new MathBackendCPU();
      } else if (type.toLowerCase() === 'webgl') {
        backend = () => new MathBackendWebGL();
      } else {
        throw new Error(
            `Unknown value ${type} for flag --backend. ` +
            `Allowed values are 'cpu' or 'webgl'.`);
      }
    } else if (arg === '--name') {
      name = args[i + 1];
    }
  });

  if (features == null && backend == null) {
    return;
  }
  if (features != null && backend == null) {
    throw new Error(
        '--backend flag is required when --features is present. ' +
        'Available values are "webgl" or "cpu".');
  }
  setTestEnvs([{features: features || {}, factory: backend, name}]);
}

export function describeWithFlags(
    name: string, constraints: Features, tests: () => void) {
  TEST_ENVS.forEach(testEnv => {
    ENV.setFeatures(testEnv.features);
    if (envSatisfiesConstraints(constraints)) {
      const testName =
          name + ' ' + testEnv.name + ' ' + JSON.stringify(testEnv.features);
      executeTests(testName, tests, testEnv);
    }
  });
}

export interface TestEnv {
  name: string;
  factory: () => KernelBackend;
  features: Features;
}

export let TEST_ENVS: TestEnv[] = [
  {
    name: 'test-webgl1',
    factory: () => new MathBackendWebGL(),
    features: {'WEBGL_VERSION': 1}
  },
  {
    name: 'test-webgl2',
    factory: () => new MathBackendWebGL(),
    features: {'WEBGL_VERSION': 2}
  },
  {
    name: 'test-cpu',
    factory: () => new MathBackendCPU(),
    features: {'HAS_WEBGL': false}
  }
];

if (typeof __karma__ !== 'undefined') {
  parseKarmaFlags();
}

export function setTestEnvs(testEnvs: TestEnv[]) {
  TEST_ENVS = testEnvs;
}

function executeTests(testName: string, tests: () => void, testEnv: TestEnv) {
  describe(testName, () => {
    beforeAll(() => {
      ENV.setFeatures(testEnv.features);
      ENV.registerBackend(testEnv.name, testEnv.factory, 1000);
      Environment.setBackend(testEnv.name);
    });

    beforeEach(() => {
      ENV.engine.startScope();
    });

    afterEach(() => {
      ENV.engine.endScope();
      Environment.disposeVariables();
    });

    afterAll(() => {
      ENV.removeBackend(testEnv.name);
      ENV.reset();
    });

    tests();
  });
}
