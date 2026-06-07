import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { PageTitle } from '../../components/ui/PageTitle';

export function NotFoundPage() {
   return (
      <>
         <PageTitle
            eyebrow="404"
            title="Página não encontrada"
            description="O caminho acessado não existe ou foi removido."
         />
         <Link to="/">
            <Button variant="primary">Voltar para o início</Button>
         </Link>
      </>
   );
}
