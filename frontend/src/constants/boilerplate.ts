/**
 * Fixed text transcribed from the sample quotations. Both DOCX files carry these
 * sections identically, so they are constants rather than form fields.
 *
 * One correction: the samples read "Form Solar Green Technology" in the sign-off,
 * a typo for "From". Corrected here — see PROJECT_PLAN.md §8.
 */

export const COVER_LETTER: readonly string[] = [
  'We thank you for your interest evinced in us and are happy to partner with you in your solar aspirations. Based on our discussions, we are pleased to provide our EPC offer for Installation and commissioning of grid tied Solar Power Plant mentioned on the next page including the list of materials used in our project.',
  'We ensure you that our work is professional and of the highest quality you will find in this price range, we can also assure and guarantee that this project will be of utmost priority for us with timely services and workmanship.',
] as const

export const SCOPE_OF_WORKS_INTRO =
  'Installation and Construction of the Project with associated civil and electrical installations up to AC Distribution Board provided along with solar power plant, according to design provided.'

export const SCOPE_OF_WORKS: readonly string[] = [
  'Civil works of structure via riveting for installation of modules and electrical equipment.',
  'Solar Panel Modules mounting & installation on the structure.',
  'Installation Solar Inverters, AC DB, DC DB cabling and associated structural & electrical items.',
  'LA Installation, Earth pit chamber construction.',
  'Plant earthing work with GI Strips.',
  'LT Panel installation & LT Cabling beyond AC Distribution Board to the interconnection point LT Panel / MV Panel.',
  'Testing and commissioning of individual equipment and completion of solar plant upto AC Distribution Board.',
] as const

export const CLIENT_SCOPE: readonly { title: string; body: string }[] = [
  {
    title: 'Security of Material',
    body: 'On delivery of materials to buyer’s site in good condition, the buyer shall be responsible for safety & security of the system till handing over of the same to our designated personnel for installation.',
  },
  {
    title: 'Security of personnel',
    body: 'In case there are social disturbances in the buyer’s site not attributable to us, the buyer shall resolve the same at its own risk & cost, for smooth execution of the project by us. In such case, the buyer shall provide safety & security to our designated personnel working at site. Any delay in execution due to social disturbances at site shall be attributable to the buyer and not compensated by us. Further, any damage to the system due to social disturbances/vandalism at site shall be compensated by the buyer.',
  },
  {
    title: 'Leveling of land',
    body: 'If the installation is on Land, cleaning and leveling of land to make it suitable for the installation if in the scope of the client.',
  },
  {
    title: 'Net Metering / Load Increasing',
    body: 'As per the Discom Guidelines (TATA Power/ AVVNL/JVVNL) net metering is an arrangement between the client and the Discom (TATA Power/ AVVNL/JVVNL) and it remains under client’s scope. All the government fees and agreement charges have to be deposited by the client regarding net-metering and load enhancement. We will only assist in the procedure, paper work and liaising.',
  },
] as const

export const TERMS_AND_CONDITIONS: readonly string[] = [
  'The price is inclusive of applicable taxes and duties.',
  'Prevailing applicable 05 % (70%) GST on the Supply and 18 % (30%) GST on the Installation and commissioning.',
  'Average GST – 8.9 %',
] as const

export const SUBSIDY_NOTE = (amount: string, afterSubsidy: string): string[] => [
  `NOTE :- Once client have to pay the total project cost. After that subsidy amount (that will be ${amount}) will be released afterwards.`,
  `Total Project cost after subsidy :- ${afterSubsidy}`,
]

/** Reference projects. The 325kW document's 7-entry list is canonical. */
export const REFERENCE_PROJECTS: readonly { name: string; capacity: string }[] = [
  { name: 'EPC - Mayo College Girls School, Ajmer', capacity: '300 KW' },
  { name: 'EPC - SARAS Cattle feed Dairy Ajmer Project', capacity: '600 KW' },
  { name: 'INC - Durlab ji Hospital, Jaipur Project', capacity: '300 KW' },
  { name: 'INC - Jwellery Zone, Jaipur Project', capacity: '100 KW' },
  { name: 'INC - Vidhan Sabha, Jaipur Project', capacity: '600 KW' },
  { name: 'EPC - Mahesh Marbles, Kishangarh Project', capacity: '65 KW' },
  { name: 'EPC - Mahaveer Group Palra Industries area Ajmer', capacity: '490 KW' },
] as const

/** The single priced row. Description is fixed on both sample quotations. */
export const PRICE_ROW_DESCRIPTION = 'Supply of equipments and installation & commissioning'
