import { WatsonModule } from '@di/decorators';

import { ContextComponent } from './context.component';

@WatsonModule({
  components: [ContextComponent],
})
export class ContextModule {}
