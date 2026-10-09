import {
  BaseLayout,
  HeroIconBadge,
  frontendUrl,
} from "#/infra/notifications/templates/base-layout.js";
import { Button, Section, Text } from "react-email";
import * as React from "react";

interface PasswordChangedEmailProps {
  name?: string;
  surname?: string;
}

export const PasswordChangedEmail = ({
  name = "Değerli Üyemiz",
  surname = "",
}: PasswordChangedEmailProps) => {
  const displayName = [name, surname].filter(Boolean).join(" ") || "Üyemiz";
  const changeDate = new Date().toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });

  return (
    <BaseLayout
      preview="Dinlet şifreniz başarıyla değiştirildi."
      footerType="minimal"
      footerNote="© 2025 Dinlet Inc. • Otomatik Güvenlik İletisi"
    >
      {/* HERO SECTION */}
      <Section style={{ padding: "16px 32px", textAlign: "center" }}>
        <HeroIconBadge icon="shield" variant="primary" />

        <Text
          style={{
            margin: "20px 0 8px",
            fontSize: "24px",
            fontWeight: 800,
            color: "#0B1C30",
            lineHeight: "1.25",
            textAlign: "center",
          }}
        >
          Şifreniz Başarıyla Güncellendi
        </Text>

        <Text
          style={{
            margin: "0 auto",
            fontSize: "15px",
            color: "#565E74",
            lineHeight: "1.5",
            textAlign: "center",
          }}
        >
          Sayın <strong style={{ color: "#0B1C30" }}>{displayName}</strong>,
          <br />
          Dinlet hesabınıza ait şifre az önce başarıyla güncellendi.
        </Text>
      </Section>

      {/* INCIDENT DETAILS TABLE */}
      <Section style={{ padding: "12px 32px" }}>
        <div
          style={{
            backgroundColor: "#F8FAFC",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #F1F5F9",
          }}
        >
          <table
            border={0}
            cellPadding={0}
            cellSpacing={0}
            role="presentation"
            style={{ width: "100%", fontSize: "13px" }}
          >
            <tbody>
              <tr>
                <td
                  style={{
                    padding: "6px 0",
                    color: "#757688",
                    width: "80px",
                  }}
                >
                  Tarih:
                </td>
                <td
                  style={{
                    padding: "6px 0",
                    color: "#0B1C30",
                    fontWeight: 700,
                    textAlign: "right",
                  }}
                >
                  {changeDate}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "6px 0",
                    color: "#757688",
                  }}
                >
                  İşlem:
                </td>
                <td
                  style={{
                    padding: "6px 0",
                    color: "#0B1C30",
                    fontWeight: 700,
                    textAlign: "right",
                  }}
                >
                  Şifre Güncelleme
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* WARNING / UNAUTHORIZED ALERT CALLOUT */}
      <Section style={{ padding: "16px 32px 28px" }}>
        <div
          style={{
            backgroundColor: "#FFDAD6",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #FFCDD2",
          }}
        >
          <table
            border={0}
            cellPadding={0}
            cellSpacing={0}
            role="presentation"
            style={{ width: "100%" }}
          >
            <tbody>
              <tr>
                <td
                  style={{
                    width: "32px",
                    verticalAlign: "top",
                    paddingTop: "1px",
                  }}
                >
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "99px",
                      backgroundColor: "#BA1A1A",
                      color: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: 800,
                      fontFamily:
                        "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, Arial, sans-serif",
                      textAlign: "center",
                      lineHeight: "22px",
                    }}
                  >
                    !
                  </div>
                </td>
                <td style={{ verticalAlign: "top" }}>
                  <strong
                    style={{
                      fontSize: "14px",
                      color: "#93000A",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    Bu değişikliği siz yapmadıysanız:
                  </strong>
                  <Text
                    style={{
                      margin: "0 0 12px",
                      fontSize: "13px",
                      color: "#93000A",
                      lineHeight: "1.4",
                    }}
                  >
                    Hesabınız yetkisiz kişilerin eline geçmiş olabilir. Lütfen
                    hemen destek ekibimizle iletişime geçin veya parolanızı
                    yeniden sıfırlayın.
                  </Text>
                  <Button
                    href={`${frontendUrl}/auth/emergency-lock`}
                    style={{
                      display: "inline-block",
                      backgroundColor: "#BA1A1A",
                      color: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: 700,
                      textDecoration: "none",
                      padding: "8px 16px",
                      borderRadius: "10px",
                    }}
                  >
                    Hesabı Güvene Al
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </BaseLayout>
  );
};

export default PasswordChangedEmail;
