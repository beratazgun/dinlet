import { Transform } from 'class-transformer';

/**
 * Query parametresini array'e dönüştürür
 * Tek değer gelirse array'e çevirir, array gelirse olduğu gibi bırakır
 * @example ?status=PENDING -> ['PENDING']
 * @example ?status[]=PENDING&status[]=CONFIRMED -> ['PENDING', 'CONFIRMED']
 * @example ?status=PENDING&status=CONFIRMED -> ['PENDING', 'CONFIRMED']
 */
export function ToArray() {
  return Transform(({ value }) => {
    if (value === undefined || value === null) {
      return value;
    }
    return Array.isArray(value) ? value : [value];
  });
}

/**
 * Query parametresini boolean'a dönüştürür
 * "true", "1", "yes" -> true
 * "false", "0", "no" -> false
 * @example ?isActive=true -> true
 * @example ?isActive=1 -> true
 * @example ?isActive[]=false -> false
 */
export function ToBoolean() {
  return Transform(({ value }) => {
    if (value === undefined || value === null) {
      return value;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    const stringValue = String(value).toLowerCase();
    return (
      stringValue === 'true' || stringValue === '1' || stringValue === 'yes'
    );
  });
}

/**
 * Query parametresini number'a dönüştürür
 * @example ?page=1 -> 1
 */
export function ToNumber() {
  return Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return value;
    }
    const num = Number(value);
    return isNaN(num) ? value : num;
  });
}

/**
 * Query parametresini integer'a dönüştürür
 * @example ?id=5.7 -> 5
 */
export function ToInt() {
  return Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return value;
    }
    const num = parseInt(String(value), 10);
    return isNaN(num) ? value : num;
  });
}

/**
 * Query parametresini trim eder (boşlukları temizler)
 * @example ?search="  hello  " -> "hello"
 */
export function Trim() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  });
}

/**
 * Query parametresini lowercase'e çevirir
 * @example ?email=TEST@EXAMPLE.COM -> test@example.com
 */
export function ToLowerCase() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
    return value;
  });
}

/**
 * Query parametresini uppercase'e çevirir
 * @example ?code=abc -> ABC
 */
export function ToUpperCase() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toUpperCase();
    }
    return value;
  });
}

/**
 * Query parametresini Date'e dönüştürür
 * @example ?startDate=2024-01-01 -> Date object
 */
export function ToDate() {
  return Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return value;
    }
    const date = new Date(value);
    return isNaN(date.getTime()) ? value : date;
  });
}

/**
 * Query parametresini JSON parse eder
 * @example ?filter={"name":"test"} -> { name: "test" }
 */
export function ParseJSON() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  });
}

/**
 * Query parametresini virgülle ayrılmış string'den array'e çevirir
 * @example ?tags=tag1,tag2,tag3 -> ['tag1', 'tag2', 'tag3']
 */
export function SplitString(separator: string = ',') {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(separator).map((item) => item.trim());
    }
    return value;
  });
}

/**
 * Query parametresini default değer ile birleştirir
 * Değer yoksa default değeri kullanır
 * @example @Default(10) limit?: number
 */
export function Default(defaultValue: any) {
  return Transform(({ value }) => {
    return value === undefined || value === null || value === ''
      ? defaultValue
      : value;
  });
}
