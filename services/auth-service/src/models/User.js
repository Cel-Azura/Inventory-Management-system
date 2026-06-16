/**
 * User domain model
 * Maps to the `users` table in PostgreSQL
 */
class User {
  constructor({ id, username, password, fullname, role, status, created_at }) {
    this.id        = id;
    this.username  = username;
    this.password  = password;   // plain text in seed; hashed in production flow
    this.fullname  = fullname;
    this.role      = role      || 'staff';
    this.status    = status    || 'active';
    this.createdAt = created_at || new Date().toISOString().split('T')[0];
  }

  /** Safe public representation — strips password */
  toPublic() {
    return {
      id:        this.id,
      username:  this.username,
      fullname:  this.fullname,
      role:      this.role,
      status:    this.status,
      createdAt: this.createdAt,
    };
  }
}

module.exports = User;