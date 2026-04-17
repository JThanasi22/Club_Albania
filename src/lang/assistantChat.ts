export const assistantChatLabels = {
  openChat: 'Hap asistentin',
  title: 'Asistenti i administratorit',
  description:
    'Pyetje për lojtarët, pagesat dhe faturat. Asistenti përgjigjet në shqip; faqja kryesore mbetet e përdorshme pranë panelit. PDF, CSV dhe statistika nga serveri; shkarkimet poshtë përgjigjes.',
  placeholder: 'Shkruani pyetjen tuaj…',
  send: 'Dërgo',
  sending: 'Duke dërguar…',
  emptyThread: 'Bëni një pyetje për të filluar.',
  loginRequired: 'Duhet të hyni si administrator për të përdorur asistentin.',
  configMissing: 'Shërbimi i asistentit nuk është i konfiguruar (GOOGLE_API_KEY).',
  errorGeneric: 'Kërkesa dështoi. Provoni përsëri.',
  errorRateLimit:
    'Kuota e Google Gemini është plot për modelet e provuara. Prisni pak dhe provoni përsëri, ose vendosni GEMINI_MODEL në .env (p.sh. gemini-2.5-flash ose gemini-1.5-flash), ose aktivizoni faturimin në Google AI Studio.',
  errorGeminiAuth: 'Çelësi GOOGLE_API_KEY u refuzua nga Google. Kontrolloni çelësin dhe të drejtat e projektit.',
  clear: 'Pastro bisedën',
  downloadsHeading: 'Shkarkime',
  downloadFile: 'Shkarko skedarin',
  minimizePanel: 'Minimizo',
  expandPanel: 'Hap panelin e asistentit',
  closePanel: 'Mbyll asistentin',
  assistantTabMark: 'Asistenti',
} as const;

export type AssistantChatLabels = typeof assistantChatLabels;

export function getAssistantChatLabels(): AssistantChatLabels {
  return assistantChatLabels;
}
