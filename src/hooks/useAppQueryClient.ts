import {useQueryClient} from '@tanstack/react-query';

/**
 * Re-exported under the app's naming convention. A thin alias, kept as its
 * own file so every hook imports "the app's query client" from one place
 * rather than half from `@tanstack/react-query` and half from here.
 */
export const useAppQueryClient = useQueryClient;
