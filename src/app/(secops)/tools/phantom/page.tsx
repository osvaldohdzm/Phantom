/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';
import { PentestTargetMapPanel } from '@/components/phantom/PentestTargetMapPanel';

export default function App() {
  return (
    <div className="phantom-workspace w-full h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      <PentestTargetMapPanel className="flex-1" />
    </div>
  );
}
