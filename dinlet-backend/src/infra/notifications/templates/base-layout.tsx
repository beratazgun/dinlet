import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
  Button,
} from "react-email";
import * as React from "react";

export interface BaseLayoutProps {
  preview: string;
  children: React.ReactNode;
  headerType?: "default" | "none";
  footerType?: "default" | "minimal" | "ops";
  footerCategory?: string;
  footerNote?: string;
}

export const frontendUrl =
  process.env.PUBLIC_FRONTEND_URL || "https://dinlet.app";

export const SoundwaveLogo = ({
  variant = "default",
}: {
  variant?: "default" | "white";
}) => {
  const barColor = variant === "white" ? "#FFFFFF" : "#1D3FE8";
  const textColor = variant === "white" ? "#FFFFFF" : "#0B1C30";

  return (
    <table
      border={0}
      cellPadding={0}
      cellSpacing={0}
      role="presentation"
      style={{ margin: "0 auto", display: "inline-table" }}
    >
      <tbody>
        <tr>
          <td style={{ verticalAlign: "middle", paddingRight: "8px" }}>
            <table
              border={0}
              cellPadding={0}
              cellSpacing={0}
              role="presentation"
              style={{ height: "28px" }}
            >
              <tbody>
                <tr>
                  <td style={{ verticalAlign: "middle", padding: "0 1.5px" }}>
                    <div
                      style={{
                        width: "3px",
                        height: "12px",
                        backgroundColor: barColor,
                        borderRadius: "99px",
                      }}
                    />
                  </td>
                  <td style={{ verticalAlign: "middle", padding: "0 1.5px" }}>
                    <div
                      style={{
                        width: "3px",
                        height: "22px",
                        backgroundColor: barColor,
                        borderRadius: "99px",
                      }}
                    />
                  </td>
                  <td style={{ verticalAlign: "middle", padding: "0 1.5px" }}>
                    <div
                      style={{
                        width: "3px",
                        height: "28px",
                        backgroundColor: barColor,
                        borderRadius: "99px",
                      }}
                    />
                  </td>
                  <td style={{ verticalAlign: "middle", padding: "0 1.5px" }}>
                    <div
                      style={{
                        width: "3px",
                        height: "18px",
                        backgroundColor: barColor,
                        borderRadius: "99px",
                      }}
                    />
                  </td>
                  <td style={{ verticalAlign: "middle", padding: "0 1.5px" }}>
                    <div
                      style={{
                        width: "3px",
                        height: "10px",
                        backgroundColor: barColor,
                        borderRadius: "99px",
                      }}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
          <td style={{ verticalAlign: "middle" }}>
            <span
              style={{
                fontSize: "24px",
                fontWeight: 800,
                color: textColor,
                letterSpacing: "-0.5px",
                fontFamily:
                  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              }}
            >
              Dinlet
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  );
};

const ICON_URLS: Record<string, string> = {
  mark_email_read: "https://img.icons8.com/ios-filled/96/1D3FE8/mail.png",
  lock_reset: "https://img.icons8.com/ios-filled/96/1D3FE8/lock-2.png",
  shield: "https://img.icons8.com/ios-filled/96/0027BD/shield.png",
  delete_forever: "https://img.icons8.com/ios-filled/96/BA1A1A/trash--v1.png",
  lock_clock: "https://img.icons8.com/ios-filled/96/BA1A1A/lock.png",
  phonelink_lock: "https://img.icons8.com/ios-filled/96/1D3FE8/multiple-devices.png",
  terminal: "https://img.icons8.com/ios-filled/96/7BD0FF/console.png",
};

export const HeroIconBadge = ({
  icon,
  variant = "primary",
}: {
  icon: string;
  badgeText?: string;
  variant?: "primary" | "danger";
}) => {
  const isDanger = variant === "danger";
  const bgColor = isDanger ? "#FFDAD6" : "#EFF6FF";
  const iconUrl =
    ICON_URLS[icon] ||
    (isDanger
      ? "https://img.icons8.com/ios-filled/96/BA1A1A/lock.png"
      : "https://img.icons8.com/ios-filled/96/1D3FE8/mail.png");

  return (
    <table
      border={0}
      cellPadding={0}
      cellSpacing={0}
      role="presentation"
      style={{ margin: "0 auto" }}
    >
      <tbody>
        <tr>
          <td
            align="center"
            valign="middle"
            style={{
              width: "84px",
              height: "84px",
              borderRadius: "26px",
              backgroundColor: bgColor,
              textAlign: "center",
              verticalAlign: "middle",
            }}
          >
            <Img
              src={iconUrl}
              alt=""
              width="44"
              height="44"
              style={{
                display: "block",
                margin: "0 auto",
                width: "44px",
                height: "44px",
                border: "0",
                outline: "none",
                textDecoration: "none",
              }}
            />
          </td>
        </tr>
      </tbody>
    </table>
  );
};

export const PrimaryButton = ({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) => {
  return (
    <Button
      href={href}
      className="bg-[#1D3FE8] text-white font-bold text-[16px] px-6 py-4 [text-decoration:none] block text-center"
      style={{
        backgroundColor: "#1D3FE8",
        color: "#FFFFFF",
        borderRadius: "16px",
        padding: "16px 24px",
        fontSize: "16px",
        fontWeight: 700,
        textDecoration: "none",
        textAlign: "center",
        boxShadow: "0 4px 14px rgba(29, 63, 232, 0.35)",
        display: "block",
        boxSizing: "border-box",
        width: "100%",
        fontFamily:
          "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {children}
    </Button>
  );
};

export const BaseLayout = ({
  preview,
  children,
  headerType = "default",
  footerType = "default",
  footerCategory,
  footerNote,
}: BaseLayoutProps) => {
  return (
    <Html>
      <Tailwind>
        <Head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin=""
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
            rel="stylesheet"
          />
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap');
            .material-symbols-outlined {
              font-family: 'Material Symbols Outlined', 'Material Icons', sans-serif;
              font-weight: normal;
              font-style: normal;
              font-size: 40px;
              line-height: 1;
              letter-spacing: normal;
              text-transform: none;
              display: inline-block;
              white-space: nowrap;
              word-wrap: normal;
              direction: ltr;
              -webkit-font-feature-settings: 'liga';
              -webkit-font-smoothing: antialiased;
            }
          `}</style>
        </Head>
        <Preview>{preview}</Preview>
        <Body
          className="bg-[#F8FAFC] m-0 p-0"
          style={{
            backgroundColor: "#F8FAFC",
            fontFamily:
              "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          }}
        >
          <Container className="mx-auto my-8 max-w-[560px] p-4">
            {/* MAIN WHITE CARD */}
            <Section
              className="bg-white overflow-hidden"
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "24px",
                overflow: "hidden",
                boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.05)",
                border: "1px solid #F1F5F9",
              }}
            >
              {/* BRAND HEADER */}
              {headerType === "default" && (
                <Section
                  className="text-center"
                  style={{
                    padding: "32px 32px 16px",
                    textAlign: "center",
                  }}
                >
                  <SoundwaveLogo />
                </Section>
              )}

              {/* CARD CONTENT */}
              <Section>{children}</Section>

              {/* CARD FOOTER */}
              <Section
                style={{
                  backgroundColor: "#F8FAFC",
                  padding: "24px 32px",
                  textAlign: "center",
                  borderTop: "1px solid #F1F5F9",
                }}
              >
                {footerType === "ops" ? (
                  <Text
                    style={{
                      margin: 0,
                      fontSize: "11px",
                      color: "#757688",
                      lineHeight: "1.5",
                      fontFamily:
                        "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    }}
                  >
                    Bu uyarı Dinlet Cloud SRE otomasyon sistemi tarafından
                    üretilmiştir.
                  </Text>
                ) : footerType === "minimal" ? (
                  <Text
                    style={{
                      margin: 0,
                      fontSize: "11px",
                      color: "#757688",
                      lineHeight: "1.5",
                      fontFamily:
                        "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    }}
                  >
                    {footerNote ||
                      `© ${new Date().getFullYear()} Dinlet Inc. • ${footerCategory || "Güvenlik Bildirimi"}`}
                  </Text>
                ) : (
                  <>
                    <div
                      style={{
                        marginBottom: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#565E74",
                        textAlign: "center",
                        fontFamily:
                          "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                      }}
                    >
                      <Link
                        href={frontendUrl}
                        style={{
                          color: "#565E74",
                          textDecoration: "none",
                          margin: "0 6px",
                        }}
                      >
                        Dinlet Audio
                      </Link>
                      <span style={{ color: "#C5C5D9" }}>•</span>
                      <Link
                        href={`${frontendUrl}/kutuphane`}
                        style={{
                          color: "#565E74",
                          textDecoration: "none",
                          margin: "0 6px",
                        }}
                      >
                        PDF&apos;ten Sese
                      </Link>
                      <span style={{ color: "#C5C5D9" }}>•</span>
                      <Link
                        href={`${frontendUrl}/destek`}
                        style={{
                          color: "#565E74",
                          textDecoration: "none",
                          margin: "0 6px",
                        }}
                      >
                        Yardım Merkezi
                      </Link>
                    </div>
                    <Text
                      style={{
                        margin: 0,
                        fontSize: "11px",
                        color: "#757688",
                        lineHeight: "1.5",
                        fontFamily:
                          "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                      }}
                    >
                      © {new Date().getFullYear()} Dinlet Inc. Maslak Mah.
                      Büyükdere Cad. No:193 Sarıyer, İstanbul.
                      <br />
                      {footerNote ||
                        "Bu e-posta hesabınızın güvenliği nedeniyle otomatik gönderilmiştir."}
                    </Text>
                  </>
                )}
              </Section>
            </Section>

            {/* EXTERNAL LEGAL LINKS */}
            <Section style={{ padding: "16px 8px 0", textAlign: "center" }}>
              <Text
                style={{
                  margin: 0,
                  fontSize: "11px",
                  color: "#9CA3AF",
                  fontFamily:
                    "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                }}
              >
                <Link
                  href={`${frontendUrl}/gizlilik`}
                  style={{ color: "#757688", textDecoration: "underline" }}
                >
                  Gizlilik Politikası
                </Link>
                <span style={{ margin: "0 8px", color: "#CBD5E1" }}>·</span>
                <Link
                  href={`${frontendUrl}/kullanim-kosullari`}
                  style={{ color: "#757688", textDecoration: "underline" }}
                >
                  Kullanım Koşulları
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default BaseLayout;
