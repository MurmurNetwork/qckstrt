import bootstrap from 'src/common/bootstrap';
import { AppModule } from './app.module';

bootstrap(AppModule, { portEnvVar: 'REGION_PORT' });
