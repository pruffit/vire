import { Button, Card, CardContent, CardHeader, CardTitle } from '@vire/ui';

export default function HomePage() {
  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Vire</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Независимая музыкальная площадка для артистов и слушателей СНГ.
          </p>
          <div className="flex gap-2">
            <Button size="sm">Войти</Button>
            <Button size="sm" variant="ghost">
              Обзор
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
