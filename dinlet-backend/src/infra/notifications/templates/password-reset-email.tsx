import {
  BaseLayout,
  HeroIconBadge,
  PrimaryButton,
} from "#/infra/notifications/templates/base-layout.js";
import { Img, Text, Section } from "react-email";
import * as React from "react";

interface PasswordResetEmailProps {
  userName: string;
  resetLink: string;
  expiresIn: string;
}

export const PasswordResetEmail = ({
  userName,
  resetLink,
  expiresIn,
}: PasswordResetEmailProps) => {
  return (
    <BaseLayout
      preview="Dinlet şifre sıfırlama talebiniz."
      footerType="minimal"
      footerNote="© 2025 Dinlet Inc. • Güvenlik Bildirimi"
    >
      {/* HERO SECTION */}
      <Section style={{ padding: "16px 32px", textAlign: "center" }}>
        <HeroIconBadge icon="lock_reset" variant="primary" />

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
          Şifre Sıfırlama Talebi
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
          Merhaba <strong style={{ color: "#0B1C30" }}>{userName}</strong>,
          <br />
          Dinlet hesabın için bir şifre sıfırlama talebinde bulundun. Yeni
          şifreni belirlemek için aşağıdaki düğmeye tıkla.
        </Text>
      </Section>

      {/* CTA BUTTON */}
      <Section style={{ padding: "16px 32px", textAlign: "center" }}>
        <PrimaryButton href={resetLink}>Yeni Şifre Belirle</PrimaryButton>
      </Section>

      {/* EXPIRATION & SECURITY CALLOUT */}
      <Section style={{ padding: "12px 32px 28px" }}>
        <div
          style={{
            backgroundColor: "#EFF6FF",
            borderRadius: "14px",
            padding: "14px 16px",
            border: "1px solid #DBEAFE",
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
                    paddingTop: "1px",
                  }}
                >
                  <Img
                    src="https://img.icons8.com/ios-filled/48/1D3FE8/clock.png"
                    alt="⏱"
                    width="18"
                    height="18"
                    style={{
                      display: "block",
                      width: "18px",
                      height: "18px",
                      border: "0",
                    }}
                  />
                </td>
                <td style={{ verticalAlign: "top" }}>
                  <Text
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: "#002C99",
                      fontWeight: 600,
                      lineHeight: "1.4",
                    }}
                  >
                    Bu bağlantı{" "}
                    <strong style={{ color: "#0B1C30" }}>{expiresIn}</strong>{" "}
                    boyunca geçerlidir.
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <Text
          style={{
            margin: "14px 0 0",
            fontSize: "12px",
            color: "#757688",
            lineHeight: "1.4",
            textAlign: "center",
          }}
        >
          Eğer bu işlemi sen talep etmediysen lütfen bu e-postayı dikkate alma;
          mevcut şifren güvende kalmaya devam eder.
        </Text>
      </Section>
    </BaseLayout>
  );
};

export default PasswordResetEmail;
