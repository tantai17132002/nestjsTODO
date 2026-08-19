import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Constraint bảo đảm dateFrom không lớn hơn dateTo khi cả hai cùng có mặt.
 */
@ValidatorConstraint({ name: 'dateRange', async: false })
export class DateRangeConstraint implements ValidatorConstraintInterface {
  /**
   * @param _value Giá trị dateTo đang được validate.
   * @param args Query DTO chứa dateFrom/dateTo.
   * @returns true nếu khoảng ngày hợp lệ hoặc thiếu một phía.
   */
  validate(_value: unknown, args: ValidationArguments): boolean {
    const object = args.object as { dateFrom?: string; dateTo?: string };
    if (!object.dateFrom || !object.dateTo) {
      return true;
    }
    return new Date(object.dateFrom).getTime() <= new Date(object.dateTo).getTime();
  }

  /**
   * @returns Thông báo khi dateFrom > dateTo.
   */
  defaultMessage(): string {
    return 'dateFrom must be less than or equal to dateTo';
  }
}

/**
 * Decorator gắn lên dateTo để kiểm tra khoảng ngày tạo todo.
 *
 * @param validationOptions Tùy chọn class-validator.
 * @returns Property decorator.
 */
export function IsValidDateRange(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isValidDateRange',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: DateRangeConstraint,
    });
  };
}
