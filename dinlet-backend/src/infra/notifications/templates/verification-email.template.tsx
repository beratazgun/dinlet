import {
  BaseLayout,
  HeroIconBadge,
  PrimaryButton,
} from "#/infra/notifications/templates/base-layout.js";
import { Text, Section, Link } from "react-email";
import * as React from "react";

interface VerificationEmailProps {
  name: string;
  surname: string;
  confirmUrl: string;
}

export const VerificationEmail = ({
  name,
  surname,
  confirmUrl,
}: VerificationEmailProps) => {
  const fullName = [name, surname].filter(Boolean).join(" ");

  return (
    <BaseLayout preview="Dinlet hesabınızı doğrulamak ve notlarınızı sese dönüştürmek için e-posta adresinizi onaylayın.">
      {/* HERO SECTION */}
      <Section style={{ padding: "16px 32px", textAlign: "center" }}>
        <HeroIconBadge icon="mark_email_read" variant="primary" />

        <Text
          style={{
            margin: "24px 0 8px",
            fontSize: "26px",
            fontWeight: 800,
            color: "#0B1C30",
            lineHeight: "1.25",
            textAlign: "center",
          }}
        >
          E-postanı onayla
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
          Merhaba <strong style={{ color: "#0B1C30" }}>{fullName}</strong>,
          <br />
          Dinlet hesabını tamamlamak ve notlarını sese dönüştürmeye başlamak için
          tek yapman gereken e-posta adresini onaylamak.
        </Text>
      </Section>

      {/* CTA BUTTON */}
      <Section style={{ padding: "16px 32px", textAlign: "center" }}>
        <PrimaryButton href={confirmUrl}>E-posta Adresimi Doğrula</PrimaryButton>

        <Text
          style={{
            margin: "14px 0 0",
            fontSize: "12px",
            color: "#757688",
            lineHeight: "1.4",
            textAlign: "center",
          }}
        >
          Buton çalışmıyorsa aşağıdaki bağlantıyı tarayıcına yapıştırabilirsin:
          <br />
          <Link
            href={confirmUrl}
            style={{
              display: "inline-block",
              marginTop: "4px",
              wordBreak: "break-all",
              color: "#1D3FE8",
              fontFamily: "monospace",
              fontSize: "12px",
              textDecoration: "underline",
            }}
          >
            {confirmUrl}
          </Link>
        </Text>
      </Section>

      {/* SECURITY NOTICE CALLOUT */}
      <Section style={{ padding: "16px 32px 32px" }}>
        <div
          style={{
            backgroundColor: "#F8FAFC",
            borderRadius: "16px",
            padding: "14px 16px",
            border: "1px solid #F1F5F9",
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
                    width: "28px",
                    verticalAlign: "top",
                    paddingTop: "2px",
                  }}
                >
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "99px",
                      backgroundColor: "#1D3FE8",
                      color: "#FFFFFF",
                      fontSize: "12px",
                      fontWeight: 800,
                      fontFamily:
                        "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, Arial, sans-serif",
                      textAlign: "center",
                      lineHeight: "20px",
                    }}
                  >
                    i
                  </div>
                </td>
                <td style={{ verticalAlign: "top" }}>
                  <Text
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: "#565E74",
                      lineHeight: "1.4",
                    }}
                  >
                    Birkaç dakika içinde e-posta gelmezse gereksiz (spam)
                    klasörüne göz atabilirsin. Bu işlemi sen başlatmadıysan bu
                    e-postayı görmezden gelebilirsin. Güvenlik gereği bağlantı 24
                    saat geçerlidir.
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </BaseLayout>
  );
};

export default VerificationEmail;
