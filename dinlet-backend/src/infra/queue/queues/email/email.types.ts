/** E-posta kuyruğuna eklenen bir job'un taşıdığı veri. */
export interface EmailJobData {
  to: string | string[];
  /** `notification_templates.code` — hangi şablonun gönderileceği. */
  code: string;
  /** Şablondaki `{{değişken}}` yerlerine geçilecek değerler. */
  variables: Record<string, unknown>;
}
