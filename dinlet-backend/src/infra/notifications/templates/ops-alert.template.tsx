import { BaseLayout } from "#/infra/notifications/templates/base-layout.js";
import { Button, Img, Section, Text } from "react-email";
import * as React from "react";

interface OpsAlertEmailProps {
  title?: string;
  details?: string;
  checkedAt?: string;
}

export const OpsAlertEmail = ({
  title = "Sistem Uyarısı",
  details = "",
  checkedAt = "-",
}: OpsAlertEmailProps) => {
  return (
    <BaseLayout preview={title} headerType="none" footerType="ops">
      {/* DARK TERMINAL HEADER */}
      <Section
        style={{
          backgroundColor: "#213145",
          padding: "24px 32px",
          color: "#FFFFFF",
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
              <td style={{ verticalAlign: "middle" }}>
                <table
                  border={0}
                  cellPadding={0}
                  cellSpacing={0}
                  role="presentation"
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          verticalAlign: "middle",
                          paddingRight: "8px",
                        }}
                      >
                        <Img
                          src="https://img.icons8.com/ios-filled/48/7BD0FF/console.png"
                          alt="&gt;_"
                          width="22"
                          height="22"
                          style={{
                            display: "block",
                            width: "22px",
                            height: "22px",
                            border: "0",
                          }}
                        />
                      </td>
                      <td style={{ verticalAlign: "middle" }}>
                        <span
                          style={{
                            fontSize: "18px",
                            fontWeight: 800,
                            color: "#FFFFFF",
                            letterSpacing: "-0.5px",
                            fontFamily:
                              "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                          }}
                        >
                          Dinlet Ops Sentry
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
              <td style={{ verticalAlign: "middle", textAlign: "right" }}>
                <span
                  style={{
                    backgroundColor: "#FFDAD6",
                    color: "#93000A",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "99px",
                    textTransform: "uppercase",
                    display: "inline-block",
                    fontFamily:
                      "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  }}
                >
                  P1 UYARI
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* CONTENT */}
      <Section style={{ padding: "24px 32px" }}>
        <Text
          style={{
            margin: "0 0 8px",
            fontSize: "20px",
            fontWeight: 800,
            color: "#0B1C30",
            lineHeight: "1.3",
          }}
        >
          {title}
        </Text>

        <Text
          style={{
            margin: "0 0 16px",
            fontSize: "12px",
            color: "#757688",
          }}
        >
          Tetiklenme Zamanı:{" "}
          <strong style={{ color: "#0B1C30" }}>{checkedAt}</strong>
        </Text>

        {/* TECHNICAL DETAILS BOX */}
        <div
          style={{
            backgroundColor: "#F8FAFC",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "20px",
            border: "1px solid #F1F5F9",
          }}
        >
          <Text
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#565E74",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              margin: "0 0 6px",
            }}
          >
            Teknik Teşhis Detayı
          </Text>
          <Text
            style={{
              margin: 0,
              fontFamily: "monospace",
              fontSize: "13px",
              color: "#0B1C30",
              lineHeight: "1.5",
              whiteSpace: "pre-wrap",
            }}
          >
            {details}
          </Text>
        </div>

        {/* DUAL ACTION BUTTONS */}
        <table
          border={0}
          cellPadding={0}
          cellSpacing={0}
          role="presentation"
          style={{ width: "100%" }}
        >
          <tbody>
            <tr>
              <td style={{ width: "50%", paddingRight: "6px" }}>
                <Button
                  href="https://ops.dinlet.internal/incidents"
                  style={{
                    display: "block",
                    boxSizing: "border-box",
                    width: "100%",
                    backgroundColor: "#1D3FE8",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: 700,
                    textDecoration: "none",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    textAlign: "center",
                    fontFamily:
                      "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  }}
                >
                  Grafana Dashboard
                </Button>
              </td>
              <td style={{ width: "50%", paddingLeft: "6px" }}>
                <Button
                  href="https://ops.dinlet.internal/runbooks"
                  style={{
                    display: "block",
                    boxSizing: "border-box",
                    width: "100%",
                    backgroundColor: "#F1F5F9",
                    color: "#0B1C30",
                    fontSize: "14px",
                    fontWeight: 700,
                    textDecoration: "none",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    textAlign: "center",
                    fontFamily:
                      "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  }}
                >
                  Runbook Oku
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>
    </BaseLayout>
  );
};

export default OpsAlertEmail;
