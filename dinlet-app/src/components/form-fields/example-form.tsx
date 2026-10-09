import React from "react";
import { View, ScrollView } from "react-native";
import { Button, Card, Text } from "panelui-native";
import { useAppForm } from "@/context/form-context";
import type { DateRangeFieldValue } from "@/components/form-fields/core/date-range-field";

export function ExampleForm() {
  const form = useAppForm({
    defaultValues: {
      fullName: "",
      phone: "",
      bio: "",
      role: "developer",
      agreeTerms: false,
      notifications: true,
      birthDate: "",
      dateRange: undefined as DateRangeFieldValue | undefined,
      isEmployed: true,
      status: true,
      experienceYears: 3,
      rating: 80,
      gender: "unspecified",
      otpCode: "",
    },
    onSubmit: async ({ value }) => {
      console.log("Form submitted successfully:", value);
    },
  });

  return (
    <ScrollView className="flex-1 p-4 bg-background">
      <Card className="gap-6 p-4">
        <Text size="xl" weight="bold">
          PanelUI & TanStack Form Örneği
        </Text>

        {/* 1. TextField */}
        <form.AppField
          name="fullName"
          validators={{
            onChange: ({ value }) =>
              !value ? "Ad Soyad alanı zorunludur" : undefined,
          }}
        >
          {(field) => (
            <field.TextField
              label="Ad Soyad"
              placeholder="Örn: Berat Aygün"
              isRequired
            />
          )}
        </form.AppField>

        {/* 2. PhoneTextField */}
        <form.AppField
          name="phone"
          validators={{
            onChange: ({ value }) =>
              value && value.length < 13
                ? "Geçerli bir telefon numarası giriniz"
                : undefined,
          }}
        >
          {(field) => (
            <field.PhoneTextField
              label="Telefon Numarası"
              placeholder="5XX XXX XX XX"
            />
          )}
        </form.AppField>

        {/* 3. TextareaField */}
        <form.AppField name="bio">
          {(field) => (
            <field.TextareaField
              label="Hakkımda"
              placeholder="Kendinizden bahsedin..."
              rows={3}
              autoGrow
              maxLength={200}
              showCount
            />
          )}
        </form.AppField>

        {/* 4. SelectField */}
        <form.AppField name="role">
          {(field) => (
            <field.SelectField
              label="Rol / Pozisyon"
              options={[
                { value: "developer", label: "Yazılımcı" },
                { value: "designer", label: "Tasarımcı" },
                { value: "manager", label: "Yönetici" },
              ]}
              presentation="sheet"
            />
          )}
        </form.AppField>

        {/* 5. DateField */}
        <form.AppField name="birthDate">
          {(field) => (
            <field.DateField label="Doğum Tarihi" placeholder="Tarih seçiniz" />
          )}
        </form.AppField>

        {/* 6. DateRangeField */}
        <form.AppField name="dateRange">
          {(field) => (
            <field.DateRangeField
              label="İzin / Tatil Aralığı"
              placeholder="Tarih aralığı seçiniz"
            />
          )}
        </form.AppField>

        {/* 7. YesNoField */}
        <form.AppField name="isEmployed">
          {(field) => (
            <field.YesNoField label="Şu an bir işte çalışıyor musunuz?" />
          )}
        </form.AppField>

        {/* 8. ActiveStatusField */}
        <form.AppField name="status">
          {(field) => <field.ActiveStatusField label="Hesap Durumu" />}
        </form.AppField>

        {/* 9. NumberInputField */}
        <form.AppField name="experienceYears">
          {(field) => (
            <field.NumberInputField
              label="Deneyim (Yıl)"
              min={0}
              max={50}
              step={1}
            />
          )}
        </form.AppField>

        {/* 10. SliderField */}
        <form.AppField name="rating">
          {(field) => (
            <field.SliderField
              label="Memnuniyet Skoru"
              min={0}
              max={100}
              step={5}
              valueFormatter={(v) => `${v}%`}
            />
          )}
        </form.AppField>

        {/* 11. RadioGroupField */}
        <form.AppField name="gender">
          {(field) => (
            <field.RadioGroupField
              label="Cinsiyet"
              options={[
                { value: "female", label: "Kadın" },
                { value: "male", label: "Erkek" },
                { value: "unspecified", label: "Belirtmek İstemiyorum" },
              ]}
              variant="card"
            />
          )}
        </form.AppField>

        {/* 12. SwitchField */}
        <form.AppField name="notifications">
          {(field) => (
            <field.SwitchField
              label="Bildirimler"
              description="Uygulama bildirimlerini anlık al"
            />
          )}
        </form.AppField>

        {/* 13. CheckboxField */}
        <form.AppField
          name="agreeTerms"
          validators={{
            onChange: ({ value }) =>
              !value ? "Kullanım şartlarını kabul etmelisiniz" : undefined,
          }}
        >
          {(field) => (
            <field.CheckboxField
              label="Kullanım ve gizlilik sözleşmesini kabul ediyorum"
              variant="default"
            />
          )}
        </form.AppField>

        {/* Submit Button */}
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              onPress={() => form.handleSubmit()}
              disabled={!canSubmit}
              loading={isSubmitting}
            >
              Kaydet
            </Button>
          )}
        </form.Subscribe>
      </Card>
    </ScrollView>
  );
}

export default ExampleForm;
