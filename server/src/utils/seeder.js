const User = require('../models/User');
const Case = require('../models/Case');
const { ROLES } = require('../constants/roles');

/**
 * Seeds initial demo accounts if database is empty
 */
const seedInitialData = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return;
    }

    console.log('[Seeder] Database is empty. Seeding initial authorized demo users...');

    const demoUsers = [
      {
        name: 'Chief Inspector Marcus Vance',
        email: 'admin@justicevault.gov',
        password: 'Password123!',
        role: ROLES.ADMIN,
        badgeNumber: 'ADMIN-001',
        department: 'Internal Affairs & System Security'
      },
      {
        name: 'Detective Sarah Jenkins',
        email: 'officer@justicevault.gov',
        password: 'Password123!',
        role: ROLES.OFFICER,
        badgeNumber: 'DET-8842',
        department: 'Major Crimes Division'
      },
      {
        name: 'Dr. Evelyn Reed',
        email: 'forensic@justicevault.gov',
        password: 'Password123!',
        role: ROLES.FORENSIC,
        badgeNumber: 'FOR-1092',
        department: 'State Cyber Forensics Laboratory'
      },
      {
        name: 'District Attorney David Miller',
        email: 'prosecutor@justicevault.gov',
        password: 'Password123!',
        role: ROLES.PROSECUTOR,
        badgeNumber: 'PROS-5501',
        department: 'Special Prosecutions Bureau'
      },
      {
        name: 'Honorable Judge Catherine Adams',
        email: 'judge@justicevault.gov',
        password: 'Password123!',
        role: ROLES.JUDGE,
        badgeNumber: 'JUD-0014',
        department: 'High Court Criminal Division'
      }
    ];

    for (const u of demoUsers) {
      await User.create(u);
    }

    console.log('[Seeder] 5 authorized personnel accounts seeded successfully:');
    console.log('         - admin@justicevault.gov (ADMIN)');
    console.log('         - officer@justicevault.gov (OFFICER)');
    console.log('         - forensic@justicevault.gov (FORENSIC)');
    console.log('         - prosecutor@justicevault.gov (PROSECUTOR)');
    console.log('         - judge@justicevault.gov (JUDGE)');
    console.log('         (Default Password: Password123!)');

    // Create an initial sample case
    const officer = await User.findOne({ email: 'officer@justicevault.gov' });
    if (officer) {
      const sampleCase = await Case.create({
        caseId: 'CASE-2026-001',
        title: 'Metro Financial Center Vault Burglary',
        description: 'Unauthorized midnight intrusion into the subterranean digital safety vault at Metro Financial Center. Suspect bypassed biometric scanners and removed physical cryptographic keys.',
        incidentDate: new Date('2026-03-14T02:30:00Z'),
        status: 'ACTIVE',
        createdBy: officer._id,
        assignedPersonnel: [officer._id]
      });
      console.log(`[Seeder] Sample case created: ${sampleCase.caseId}`);
    }
  } catch (err) {
    console.error('[Seeder] Seeding error:', err.message);
  }
};

module.exports = {
  seedInitialData
};
