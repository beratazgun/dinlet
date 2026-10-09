import {
  BaseLayout,
  HeroIconBadge,
  PrimaryButton,
  frontendUrl,
} from "#/infra/notifications/templates/base-layout.js";
import { Button, Section, Text } from "react-email";
import * as React from "react";

interface NewDeviceLoginEmailProps {
  name?: string;
  surname?: string;
  ipAddress?: string;
  userAgent?: string;
  loggedInAt?: string;
  sessionsLink?: string;
}

export const NewDeviceLoginEmail = ({
  name = "Değerli Üyemiz",
  surname = "",
  ipAddress = "-",
  userAgent = "-",
  loggedInAt,
  sessionsLink = "#",
}: NewDeviceLoginEmailProps) => {
  const displayName = [name, surname].filter(Boolean).join(" ") || "Üyemiz";
  const loginDate = new Date(loggedInAt ?? Date.now()).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });

  return (
    <BaseLayout
      preview="Dinlet hesabınıza yeni bir cihazdan giriş yapıldı."
      footerType="minimal"
      footerNote="© 2025 Dinlet Inc. • Hesap Güvenlik Protokolü"
    >
      {/* HERO SECTION */}
      <Section style={{ padding: "16px 32px", textAlign: "center" }}>
        <HeroIconBadge icon="phonelink_lock" variant="primary" />

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
          Yeni Cihazdan Giriş Yapıldı
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
          Dinlet hesabınıza daha önce kullanmadığınız yeni bir cihazdan başarılı
          bir şekilde giriş sağlandı.
        </Text>
      </Section>

      {/* DEVICE INFO TABLE */}
      <Section style={{ padding: "12px 32px" }}>
        <div
          style={{
            backgroundColor: "#F8FAFC",
            borderRadius: "16px",
            padding: "18px",
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
                    width: "110px",
                    verticalAlign: "top",
                  }}
                >
                  Cihaz / İstemci:
                </td>
                <td
                  style={{
                    padding: "6px 0",
                    color: "#0B1C30",
                    fontWeight: 700,
                    textAlign: "right",
                    wordBreak: "break-word",
                  }}
                >
                  {userAgent}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "6px 0",
                    color: "#757688",
                  }}
                >
                  IP Adresi:
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
                <td
                  style={{
                    padding: "6px 0",
                    color: "#757688",
                  }}
                >
                  Giriş Zamanı:
                </td>
                <td
                  style={{
                    padding: "6px 0",
                    color: "#0B1C30",
                    fontWeight: 600,
                    textAlign: "right",
                  }}
                >
                  {loginDate}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ACTION BUTTONS */}
      <Section style={{ padding: "16px 32px 28px", textAlign: "center" }}>
        <div style={{ marginBottom: "12px" }}>
          <PrimaryButton href={sessionsLink}>
            Aktif Oturumları Yönet
          </PrimaryButton>
        </div>

        <Button
          href={`${frontendUrl}/auth/revoke-all`}
          style={{
            display: "block",
            boxSizing: "border-box",
            width: "100%",
            backgroundColor: "#FFDAD6",
            color: "#93000A",
            fontSize: "14px",
            fontWeight: 700,
            textDecoration: "none",
            padding: "14px 20px",
            borderRadius: "14px",
            textAlign: "center",
            fontFamily:
              "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          Bu Ben Değilim (Tüm Oturumları Kapat)
        </Button>
      </Section>
    </BaseLayout>
  );
};

export default NewDeviceLoginEmail;
