import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

import ActiveStatusField from "@/components/form-fields/core/active-status-field";
import AuthTextField from "@/components/form-fields/core/auth-text-field";
import CheckboxField from "@/components/form-fields/core/checkbox-field";
import ConsentField from "@/components/form-fields/core/consent-field";
import DateField from "@/components/form-fields/core/date-field";
import DateRangeField from "@/components/form-fields/core/date-range-field";
import NumberInputField from "@/components/form-fields/core/number-input-field";
import OtpInputField from "@/components/form-fields/core/otp-input-field";
import PhoneTextField from "@/components/form-fields/core/phone-text-field";
import RadioGroupField from "@/components/form-fields/core/radio-group-field";
import SelectField from "@/components/form-fields/core/select-field";
import SliderField from "@/components/form-fields/core/slider-field";
import SwitchField from "@/components/form-fields/core/switch-field";
import TextareaField from "@/components/form-fields/core/text-area-field";
import TextField from "@/components/form-fields/core/text-field";
import YesNoField from "@/components/form-fields/core/yes-no-field";

/*
|--------------------------------------------------------------------------
| Create form context
|--------------------------------------------------------------------------
*/
export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();

/*
|--------------------------------------------------------------------------
| Create form hook
|--------------------------------------------------------------------------
*/
export const { useAppForm, withForm } = createFormHook({
  fieldComponents: {
    TextField,
    CheckboxField,
    YesNoField,
    TextareaField,
    PhoneTextField,
    DateField,
    DateRangeField,
    ActiveStatusField,
    SwitchField,
    SelectField,
    RadioGroupField,
    NumberInputField,
    OtpInputField,
    SliderField,
    AuthTextField,
    ConsentField,
  },
  formComponents: {},
  fieldContext,
  formContext,
});
