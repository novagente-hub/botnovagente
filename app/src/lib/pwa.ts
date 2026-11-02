/** Pure native-install helpers, including the iOS standalone mode. */
export function isStandalonePwa(
  matchMedia: (query: string) => { matches: boolean },
  iosStandalone = false,
) {
  return matchMedia("(display-mode: standalone)").matches || iosStandalone;
}
export function mobileInstallInstructions(userAgent: string): string {
  if (/iPad|iPhone|iPod/i.test(userAgent)) {
    return 'No Safari, toque em Compartilhar e escolha "Adicionar à Tela de Início".';
  }
  return 'No Chrome, abra o menu ⋮ e escolha "Instalar aplicativo" ou "Adicionar à tela inicial".';
}
