/**
 * Oturum cookie'si üzerinden taşınan kimlik bilgisi.
 *
 * `@fastify/session` store'unda `session.user` altında tutulur; guard'lar,
 * CASL ability factory'si ve `@CurrentUser()` decorator'ı bu tipi okur.
 */
export interface SessionUser {
  id: number;
  role: {
    id: number;
    code: string;
    isSuper: boolean;
  };
}
