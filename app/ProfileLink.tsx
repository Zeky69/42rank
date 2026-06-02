type Props = {
  login: string;
  className?: string;
  children?: React.ReactNode;
};

// Lien vers le profil 42 (intra) de l'utilisateur, ouvert dans un nouvel onglet.
export default function ProfileLink({ login, className, children }: Props) {
  return (
    <a
      href={`https://profile.intra.42.fr/users/${encodeURIComponent(login)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`profile-link${className ? ` ${className}` : ""}`}
      title={`Voir le profil 42 de ${login}`}
    >
      {children ?? login}
    </a>
  );
}
