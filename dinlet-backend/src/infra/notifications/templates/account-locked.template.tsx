import {
  BaseLayout,
  HeroIconBadge,
  PrimaryButton,
} from "#/infra/notifications/templates/base-layout.js";
import { Section, Text } from "react-email";
import * as React from "react";

interface AccountLockedEmailProps {
  name?: string;
  surname?: string;
  lockedForMinutes?: number;
  ipAddress?: string;
  resetLink?: string;
}

export const AccountLockedEmail = ({
  name = "Değerli Üyemiz",
  surname = "",
  lockedForMinutes = 15,
  ipAddress = "-",
  resetLink = "#",
}: AccountLockedEmailProps) => {
  const displayName = [name, surname].filter(Boolean).join(" ") || "Üyemiz";

  return (
    <BaseLayout
      preview="Hesabınız geçici olarak kilitlendi."
      footerType="minimal"
      footerNote="© 2025 Dinlet Güvenlik Operasyonları Merkezi"
    >
      {/* HERO SECTION */}
      <Section style={{ padding: "16px 32px", textAlign: "center" }}>
        <HeroIconBadge icon="lock_clock" variant="danger" />

        <Text
          style={{
            margin: "20px 0 8px",
            fontSize: "24px",
            fontWeight: 800,
            color: "#BA1A1A",
            lineHeight: "1.25",
            textAlign: "center",
          }}
        >
          Hesabınız Geçici Olarak Kilitlendi
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
          Merhaba <strong style={{ color: "#0B1C30" }}>{displayName}</strong>,
          <br />
          Hesabınıza birden fazla kez hatalı parola girildiği için güvenlik
          gereği hesabınız{" "}
          <strong style={{ color: "#BA1A1A" }}>
            {`${lockedForMinutes} dakika`}
          </strong>{" "}
          kilitlenmiştir.
        </Text>
      </Section>

      {/* INCIDENT DATA TABLE */}
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
                <td style={{ padding: "6px 0", color: "#757688" }}>
                  Kilit Süresi:
                </td>
                <td
                  style={{
                    padding: "6px 0",
                    color: "#0B1C30",
                    fontWeight: 700,
                    textAlign: "right",
                  }}
                >
                  {`${lockedForMinutes} Dakika`}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "6px 0", color: "#757688" }}>
                  İstek Yapan IP:
                </td>
                <td
                  style={{
                    padding: "6px 0",
                    color: "#0B1C30",
                    fontFamily: "monospace",
                    textAlign: "right",
                  }}
                >
                  {ipAddress}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "6px 0", color: "#757688" }}>
                  Kilit Statüsü:
                </td>
                <td
                  style={{
                    padding: "6px 0",
                    color: "#BA1A1A",
                    fontWeight: 700,
                    textAlign: "right",
                  }}
                >
                  Aktif Koruma
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* CTA BUTTON */}
      <Section style={{ padding: "16px 32px 28px", textAlign: "center" }}>
        <PrimaryButton href={resetLink}>
          Kilidi Kaldır &amp; Şifre Sıfırla
        </PrimaryButton>

        <Text
          style={{
            margin: "14px 0 0",
            fontSize: "12px",
            color: "#757688",
            lineHeight: "1.4",
            textAlign: "center",
          }}
        >
          Denemeleri siz yaptıysanız süre dolunca tekrar giriş yapabilirsiniz.
          Siz yapmadıysanız şifrenizi sıfırlamanızı öneririz; sıfırlama kilidi de
          hemen kaldırır.
        </Text>
      </Section>
    </BaseLayout>
  );
};

export default AccountLockedEmail;
