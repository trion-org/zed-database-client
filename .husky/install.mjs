import process from 'node:process';

if (process.env.NODE_ENV === 'production' || process.env.CI === 'true') {
  process.exit(0);
}

try {
  const husky = (await import('husky')).default;
  husky();
} catch (error) {
  console.warn(
    'Skipping Husky install because the husky package is not available yet.'
  );
  console.warn(
    'Run "npm install" to install dev dependencies and initialize Git hooks.'
  );
}
