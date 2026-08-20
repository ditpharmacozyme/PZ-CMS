import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Explicit because vite.config.ts uses globals: false -- RTL's automatic
// cleanup depends on detecting a global afterEach, which isn't present here.
// Without this, Modal's portaled DOM survives across tests and later
// getByRole('dialog') calls match more than one element.
afterEach(() => cleanup());
