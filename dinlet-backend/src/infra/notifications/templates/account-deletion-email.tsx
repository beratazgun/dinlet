import {
  BaseLayout,
  HeroIconBadge,
} from "#/infra/notifications/templates/base-layout.js";
import { Text, Section } from "react-email";
import * as React from "react";

interface AccountDeletionEmailProps {
  name: string;
  surname: string;
  code: string;
  expiresIn: string;
}

export const AccountDeletionEmail = ({
  name,
  surname,
  code,
  expiresIn,
}: AccountDeletionEmailProps) => {
  const userName = [name, surname].filter(Boolean).join(" ");

  return (
    <BaseLayout
      preview="Dinlet hesap silme doğrulama kodunuz."
      footerType="minimal"
      footerNote="© 2025 Dinlet Inc. • Hesap İşlemleri"
    >
      {/* HERO SECTION */}
      <Section style={{ padding: "16px 32px", textAlign: "center" }}>
        <HeroIconBadge icon="delete_forever" variant="danger" />

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
          Hesap Silme Onayı
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
          Dinlet hesabınızı ve tüm ses kütüphanenizi kalıcı olarak silmek için
          talepte bulundunuz.
        </Text>
      </Section>

      {/* 6-DIGIT CODE SECTION */}
      <Section style={{ padding: "16px 32px", textAlign: "center" }}>
        <Text
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "#757688",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            margin: "0 0 8px",
            textAlign: "center",
          }}
        >
          Doğrulama Kodunuz
        </Text>

        <div
          style={{
            backgroundColor: "#F1F5F9",
            borderRadius: "16px",
            padding: "18px 24px",
            display: "inline-block",
            letterSpacing: "8px",
            fontSize: "32px",
            fontWeight: 800,
            color: "#0B1C30",
            fontFamily: "monospace",
            textAlign: "center",
            margin: "0 auto",
          }}
        >
          {code}
        </div>

        <Text
          style={{
            margin: "10px 0 0",
            fontSize: "13px",
            color: "#BA1A1A",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          {`Kod ${expiresIn} geçerlidir.`}
        </Text>
      </Section>

      {/* DISCLAIMER BOX */}
      <Section style={{ padding: "8px 32px 28px" }}>
        <div
          style={{
            backgroundColor: "#F8FAFC",
            borderRadius: "14px",
            padding: "14px 16px",
            border: "1px solid #F1F5F9",
            textAlign: "center",
          }}
        >
          <Text
            style={{
              margin: 0,
              fontSize: "12px",
              color: "#757688",
              lineHeight: "1.5",
              textAlign: "center",
            }}
          >
            <strong style={{ color: "#0B1C30" }}>Dikkat:</strong> Hesabınız
            silindiğinde yüklediğiniz tüm PDF&apos;ler, seslendirilen bölümler ve
            kişisel geçmiş kalıcı olarak kaldırılır ve geri getirilemez.
          </Text>
        </div>
      </Section>
    </BaseLayout>
  );
};

export default AccountDeletionEmail;
