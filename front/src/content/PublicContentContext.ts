import { createContext } from 'react';
import type { PublicContent } from '../api/publicContent';

// Without a provider (and in the tests of single sections) the page shows what it was built with.
export const PublicContentContext = createContext<PublicContent>({ site: {}, courses: null });
