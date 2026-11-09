import { Global, Module } from '@nestjs/common';
import { DeadlineScannerService } from './deadline-scanner.service';

@Global()
@Module({
  providers: [DeadlineScannerService],
  exports: [DeadlineScannerService],
})
export class SchedulerModule {}
