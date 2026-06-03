import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  keepPreviousData,
} from '@tanstack/react-query';
import { productsService, CreateProductDto } from '@/services/products.service';

export function useProducts(
  params?: Record<string, unknown>,
  options?: { enabled?: boolean; staleTime?: number },
) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => productsService.getProducts(params),
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime,
  });
}

export function useProductsInfinite(
  params: Record<string, unknown>,
  options?: {
    enabled?: boolean;
    placeholderData?: boolean;
    staleTime?: number;
  },
) {
  const limit = Number(params.limit) || 50;
  return useInfiniteQuery({
    queryKey: ['products', 'infinite', params],
    queryFn: ({ pageParam }) =>
      productsService.getProductsPage({
        ...params,
        page: pageParam,
        limit,
        view: 'catalog',
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage?.hasMore ? (lastPage.page || 1) + 1 : undefined,
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: options?.placeholderData ? keepPreviousData : undefined,
  });
}

export function useProduct(
  productId: string | undefined,
  warehouseId?: string,
  options?: { enabled?: boolean },
) {
  const id = (productId || '').trim();
  const wh = (warehouseId || '').trim();
  return useQuery({
    queryKey: ['product', id, wh],
    queryFn: () => productsService.getProduct(id, wh || undefined),
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export function flattenProductsPages(
  data: ReturnType<typeof useProductsInfinite>['data'],
): any[] {
  if (!data?.pages?.length) return [];
  return data.pages.flatMap((page) => page.items || []);
}

export function useCatalogSummary(
  params?: Record<string, unknown>,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['products', 'summary', params],
    queryFn: () => productsService.getCatalogSummary(params),
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000,
  });
}

export function useCategories(warehouseId?: string, options?: { enabled?: boolean }) {
  const wh = (warehouseId || '').trim();
  return useQuery({
    queryKey: ['product-categories', wh],
    queryFn: () => productsService.getCategories({ warehouseId: wh }),
    enabled: (options?.enabled ?? true) && !!wh,
    staleTime: 10 * 60 * 1000,
  });
}

export function useProductActions() {
  const queryClient = useQueryClient();

  const invalidateProducts = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  const createMutation = useMutation({
    mutationFn: (dto: CreateProductDto) => productsService.createProduct(dto),
    onSuccess: invalidateProducts,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) =>
      productsService.updateProduct(id, dto),
    onSuccess: invalidateProducts,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsService.deleteProduct(id),
    onSuccess: invalidateProducts,
  });

  const addVariantMutation = useMutation({
    mutationFn: ({ productId, dto }: { productId: string; dto: any }) =>
      productsService.createVariant(productId, dto),
    onSuccess: invalidateProducts,
  });

  const addCategoryMutation = useMutation({
    mutationFn: (dto: { name: string; parentId?: string; warehouseId: string }) =>
      productsService.createCategory(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => productsService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      invalidateProducts();
    },
  });

  const publishVariantMutation = useMutation({
    mutationFn: ({ id, isPublishedToWebsite }: { id: string; isPublishedToWebsite: boolean }) =>
      productsService.publishVariant(id, isPublishedToWebsite),
    onSuccess: invalidateProducts,
  });

  return {
    createProduct: createMutation,
    updateProduct: updateMutation,
    deleteProduct: deleteMutation,
    addVariant: addVariantMutation,
    createCategory: addCategoryMutation,
    deleteCategory: deleteCategoryMutation,
    publishVariant: publishVariantMutation,
  };
}
