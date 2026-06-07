export function formatDate(value: string): string {
   try {
      return new Date(value).toLocaleDateString('pt-BR', {
         day: '2-digit',
         month: 'short',
         year: 'numeric',
      });
   } catch {
      return value;
   }
}
