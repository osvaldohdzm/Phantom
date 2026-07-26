/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';
import { PhantomServicesManager } from '@/components/phantom/services/PhantomServicesManager';

export default function SecServicesPage() {
  return (
    <div className="w-full min-h-screen bg-background">
      <PhantomServicesManager />
    </div>
  );
}
