import { Environment, Priority, TestResultStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { emptyToNull, trimString } from '../../common/utils/transforms';

export class CreateTestCaseDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Tiêu đề không được để trống' })
  @MaxLength(255)
  title: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(5000)
  preconditions?: string | null;

  @IsString()
  @MinLength(1, { message: 'Hãy nhập các bước thực hiện' })
  @MaxLength(10000)
  steps: string;

  @IsString()
  @MinLength(1, { message: 'Hãy nhập kết quả mong đợi' })
  @MaxLength(5000)
  expected: string;

  @IsOptional()
  @IsEnum(Priority, { message: 'Mức ưu tiên không hợp lệ' })
  priority?: Priority;
}

export class UpdateTestCaseDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(5000)
  preconditions?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  steps?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  expected?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class CreateTestRunDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Tên đợt kiểm thử không được để trống' })
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsEnum(Environment, { message: 'Môi trường không hợp lệ' })
  environment?: Environment | null;

  @IsOptional()
  @IsInt()
  releaseId?: number | null;

  /** Các test case đưa vào đợt chạy; bỏ trống = mọi test case chưa lưu trữ */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  testCaseIds?: number[];
}

export class ExecuteResultDto {
  @IsEnum(TestResultStatus, { message: 'Kết quả không hợp lệ' })
  status: TestResultStatus;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(5000)
  note?: string | null;

  /** Mặc định true: kết quả Fail tự tạo Bug nếu chưa có */
  @IsOptional()
  @IsBoolean()
  createBug?: boolean;
}
