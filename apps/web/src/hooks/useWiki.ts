import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';

export function useWikiConfig(projectId: string) {
  return useQuery({
    queryKey: ['wikiConfig', projectId],
    queryFn: () => api.getWikiConfig(projectId),
    enabled: !!projectId,
  });
}

export function useUpsertWikiConfig(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { autoUpdate?: string; sections?: string[] }) =>
      api.upsertWikiConfig(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wikiConfig', projectId] });
      toast.success('Wiki settings saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save wiki settings');
    },
  });
}

export function useWikiPages(projectId: string) {
  return useQuery({
    queryKey: ['wikiPages', projectId],
    queryFn: () => api.getWikiPages(projectId),
    enabled: !!projectId,
  });
}

export function useWikiPage(projectId: string, pagePath: string | null) {
  return useQuery({
    queryKey: ['wikiPage', projectId, pagePath],
    queryFn: () => api.getWikiPage(projectId, pagePath!),
    enabled: !!projectId && !!pagePath,
  });
}

export function useWikiSearch(projectId: string, query: string) {
  return useQuery({
    queryKey: ['wikiSearch', projectId, query],
    queryFn: () => api.searchWiki(projectId, query),
    enabled: !!projectId && query.length >= 2,
  });
}

export function useWikiAnnotations(projectId: string, pagePath: string | null) {
  return useQuery({
    queryKey: ['wikiAnnotations', projectId, pagePath],
    queryFn: () => api.getWikiAnnotations(projectId, pagePath!),
    enabled: !!projectId && !!pagePath,
  });
}

export function useCreateWikiAnnotation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { pagePath: string; sectionRef?: string; content: string }) =>
      api.createWikiAnnotation(projectId, data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['wikiAnnotations', projectId, variables.pagePath] });
      toast.success('Annotation added');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add annotation');
    },
  });
}

export function useUpdateWikiAnnotation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ annotationId, content }: { annotationId: string; content: string }) =>
      api.updateWikiAnnotation(projectId, annotationId, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wikiAnnotations', projectId] });
      toast.success('Annotation updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update annotation');
    },
  });
}

export function useDeleteWikiAnnotation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (annotationId: string) => api.deleteWikiAnnotation(projectId, annotationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wikiAnnotations', projectId] });
      toast.success('Annotation deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete annotation');
    },
  });
}
