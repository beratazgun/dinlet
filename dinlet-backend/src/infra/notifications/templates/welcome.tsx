import {
  BaseLayout,
  PrimaryButton,
  SoundwaveLogo,
  frontendUrl,
} from "#/infra/notifications/templates/base-layout.js";
import { Section, Text } from "react-email";
import * as React from "react";

interface WelcomeEmailProps {
  name?: string;
  surname?: string;
}

export const WelcomeEmail = ({
  name = "Değerli Üyemiz",
  surname = "",
}: WelcomeEmailProps) => {
  const displayName = [name, surname].filter(Boolean).join(" ") || "Öğrenci";

  return (
    <BaseLayout
      preview="Dinlet topluluğuna hoş geldiniz! Notlarınız artık kulağınızda."
      headerType="none"
      footerType="minimal"
      footerNote="© 2025 Dinlet • Akıllı Sesli Öğrenme Asistanı"
    >
      {/* BRAND TOP BANNER */}
      <Section
        style={{
          backgroundColor: "#1D3FE8",
          padding: "36px 32px 32px",
          textAlign: "center",
          color: "#FFFFFF",
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <SoundwaveLogo variant="white" />
        </div>
        <Text
          style={{
            margin: "0 0 8px",
            fontSize: "26px",
            fontWeight: 800,
            lineHeight: "1.25",
            color: "#FFFFFF",
            textAlign: "center",
          }}
        >
          Notların artık kulağında!
        </Text>
        <Text
          style={{
            margin: 0,
            fontSize: "15px",
            color: "#FFFFFF",
            opacity: 0.9,
            lineHeight: "1.5",
            textAlign: "center",
          }}
        >
          Hoş geldin {displayName}, her ay 30 sayfa ücretsiz dinleme hakkın
          hazır.
        </Text>
      </Section>

      {/* THREE STEP GUIDE */}
      <Section style={{ padding: "28px 32px 16px" }}>
        <Text
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "#1D3FE8",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            margin: "0 0 16px",
          }}
        >
          Dinlet Nasıl Çalışır?
        </Text>

        {/* STEP 1 */}
        <table
          border={0}
          cellPadding={0}
          cellSpacing={0}
          role="presentation"
          style={{ width: "100%", marginBottom: "18px" }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  width: "48px",
                  verticalAlign: "top",
                  paddingRight: "12px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "12px",
                    backgroundColor: "#EFF6FF",
                    color: "#1D3FE8",
                    fontWeight: 800,
                    fontSize: "15px",
                    lineHeight: "36px",
                    textAlign: "center",
                  }}
                >
                  1
                </div>
              </td>
              <td style={{ verticalAlign: "top" }}>
                <Text
                  style={{
                    margin: "0 0 4px",
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#0B1C30",
                  }}
                >
                  PDF Notunu Yükle
                </Text>
                <Text
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "#565E74",
                    lineHeight: "1.4",
                  }}
                >
                  Ders notunu, makaleni veya kitabını yükle. OCR motorumuz
                  sayfaları anında tarar.
                </Text>
              </td>
            </tr>
          </tbody>
        </table>

        {/* STEP 2 */}
        <table
          border={0}
          cellPadding={0}
          cellSpacing={0}
          role="presentation"
          style={{ width: "100%", marginBottom: "18px" }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  width: "48px",
                  verticalAlign: "top",
                  paddingRight: "12px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "12px",
                    backgroundColor: "#EFF6FF",
                    color: "#1D3FE8",
                    fontWeight: 800,
                    fontSize: "15px",
                    lineHeight: "36px",
                    textAlign: "center",
                  }}
                >
                  2
                </div>
              </td>
              <td style={{ verticalAlign: "top" }}>
                <Text
                  style={{
                    margin: "0 0 4px",
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#0B1C30",
                  }}
                >
                  Yapay Zekâ Bölümlesin
                </Text>
                <Text
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "#565E74",
                    lineHeight: "1.4",
                  }}
                >
                  Metinler akıcı paragraflara ve bölümlere ayrılır; karmaşık
                  tablolar anlatıya dönüştürülür.
                </Text>
              </td>
            </tr>
          </tbody>
        </table>

        {/* STEP 3 */}
        <table
          border={0}
          cellPadding={0}
          cellSpacing={0}
          role="presentation"
          style={{ width: "100%", marginBottom: "18px" }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  width: "48px",
                  verticalAlign: "top",
                  paddingRight: "12px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "12px",
                    backgroundColor: "#EFF6FF",
                    color: "#1D3FE8",
                    fontWeight: 800,
                    fontSize: "15px",
                    lineHeight: "36px",
                    textAlign: "center",
                  }}
                >
                  3
                </div>
              </td>
              <td style={{ verticalAlign: "top" }}>
                <Text
                  style={{
                    margin: "0 0 4px",
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#0B1C30",
                  }}
                >
                  Yolda, Sporda Dinle
                </Text>
                <Text
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "#565E74",
                    lineHeight: "1.4",
                  }}
                >
                  İlk bölüm hazır olduğunda bildirim al, metroda veya yürüyüşte
                  kulaklığını takıp öğrenmeye devam et.
                </Text>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* PRIMARY CTA */}
      <Section style={{ padding: "8px 32px 28px", textAlign: "center" }}>
        <PrimaryButton href={`${frontendUrl}/kutuphane`}>
          İlk Notunu Yükle &amp; Dinle
        </PrimaryButton>
      </Section>
    </BaseLayout>
  );
};

export default WelcomeEmail;
