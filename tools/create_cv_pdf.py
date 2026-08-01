from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from pathlib import Path

out = Path(__file__).resolve().parents[1] / 'documents' / 'David_Bedolla_CV.pdf'

NAVY = colors.HexColor('#0B1220')
BLUE = colors.HexColor('#2563EB')
MUTED = colors.HexColor('#536174')
LIGHT = colors.HexColor('#E8EEF7')

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='Name', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=25, leading=28, textColor=NAVY, spaceAfter=2))
styles.add(ParagraphStyle(name='Role', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=11.5, leading=15, textColor=BLUE, spaceAfter=8))
styles.add(ParagraphStyle(name='Contact', parent=styles['Normal'], fontSize=8.7, leading=12, textColor=MUTED, spaceAfter=10))
styles.add(ParagraphStyle(name='Section', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=12.5, leading=15, textColor=NAVY, spaceBefore=7, spaceAfter=5, borderWidth=0, borderPadding=0))
styles.add(ParagraphStyle(name='BodySmall', parent=styles['BodyText'], fontSize=8.8, leading=12, textColor=colors.HexColor('#263244'), spaceAfter=5))
styles.add(ParagraphStyle(name='JobTitle', parent=styles['BodyText'], fontName='Helvetica-Bold', fontSize=9.7, leading=12, textColor=NAVY, spaceAfter=1))
styles.add(ParagraphStyle(name='Meta', parent=styles['BodyText'], fontSize=8.2, leading=10.5, textColor=BLUE, spaceAfter=3))
styles.add(ParagraphStyle(name='BulletSmall', parent=styles['BodyText'], fontSize=8.4, leading=11.2, leftIndent=10, firstLineIndent=-7, bulletIndent=0, spaceAfter=2, textColor=colors.HexColor('#263244')))
styles.add(ParagraphStyle(name='Pub', parent=styles['BodyText'], fontSize=8.2, leading=11, textColor=colors.HexColor('#263244'), spaceAfter=5))
styles.add(ParagraphStyle(name='SkillCell', parent=styles['BodyText'], fontSize=8.1, leading=9.6, textColor=colors.HexColor('#263244'), spaceAfter=0))


def section(title):
    return [Paragraph(title.upper(), styles['Section']), Table([['']], colWidths=[7.1*inch], rowHeights=[0.012*inch], style=TableStyle([('BACKGROUND',(0,0),(-1,-1),LIGHT),('LINEABOVE',(0,0),(-1,-1),0.6,BLUE)])), Spacer(1, 4)]


def bullet(text):
    return Paragraph('• ' + text, styles['BulletSmall'])


def job(date, title, place, bullets):
    items = [Paragraph(title, styles['JobTitle']), Paragraph(f'{date} | {place}', styles['Meta'])]
    items += [bullet(x) for x in bullets]
    return KeepTogether(items + [Spacer(1, 4)])


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LIGHT)
    canvas.line(0.65*inch, 0.48*inch, 7.85*inch, 0.48*inch)
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.65*inch, 0.32*inch, 'David Bedolla, PhD | Robotics Software Engineer')
    canvas.drawRightString(7.85*inch, 0.32*inch, f'Page {doc.page}')
    canvas.restoreState()


doc = SimpleDocTemplate(
    str(out), pagesize=LETTER,
    rightMargin=0.65*inch, leftMargin=0.65*inch,
    topMargin=0.55*inch, bottomMargin=0.6*inch,
    title='David Bedolla CV', author='David Bedolla'
)

story = []
story.append(Paragraph('David Bedolla, PhD', styles['Name']))
story.append(Paragraph('Robotics Software Engineer | Real-Time Control | Motion | Hardware Deployment', styles['Role']))
story.append(Paragraph(
    'Montréal, QC, Canada &nbsp;&nbsp;|&nbsp;&nbsp; '
    '<a href="mailto:davidbedollamartinez@outlook.es" color="#536174">davidbedollamartinez@outlook.es</a> &nbsp;&nbsp;|&nbsp;&nbsp; '
    '<a href="https://www.linkedin.com/in/-davidbedolla" color="#536174">linkedin.com/in/-davidbedolla</a> &nbsp;&nbsp;|&nbsp;&nbsp; '
    '<a href="https://github.com/BedollaDavidPhD" color="#536174">github.com/BedollaDavidPhD</a><br/>'
    '<a href="https://bedolladavidphd.github.io/" color="#536174">bedolladavidphd.github.io</a> &nbsp;&nbsp;|&nbsp;&nbsp; '
    '<a href="https://orcid.org/0000-0001-8552-6842" color="#536174">orcid.org/0000-0001-8552-6842</a>', styles['Contact']))

story += section('Profile')
story.append(Paragraph(
    'Robotics software engineer with applied R&amp;D experience in real-time control, robot dynamics, high-degree-of-freedom systems, and hardware deployment. Experience includes ROS 2 and C++ control systems, redundancy resolution, inverse kinematics, rehabilitation exoskeleton controllers, symbolic modeling, and sensor-based motion generation using IMU, EMG, and depth-camera data. Work connects software architecture, dynamic modeling, motion control, hardware integration, and physical validation for assistive robotics and mobile manipulation.', styles['BodySmall']))

story += section('Professional Experience')
story.append(job('2026-Present', 'Associate Researcher', 'Lab INIT Robots, Montréal', [
    'Deployed a 400 Hz whole-body control system for a 10-DoF mobile manipulator with joystick-based commands.',
    'Implemented Kinova Gen3 redundancy resolution with approximately 3 microseconds runtime on an Intel i7 processor.',
    'Integrated the method into a real-time ROS 2 and C++ pipeline using Pinocchio.',
    'Improved Cartesian tracking with a super-twisting controller and safety-oriented command logic.'
]))
story.append(job('2025', 'Postdoctoral Researcher', 'ÉTS, Montréal', [
    'Reduced lower-limb robot control latency by 30 times, enabling torque-based control and lower tracking error.',
    'Improved ROS and Python real-time scheduling for autonomous vehicle control, reducing steering oscillations.',
    'Developed symbolic dynamics and inverse-kinematics GUI tools for rapid robot modeling and validation.',
    'Supported international collaborations on wheelchair-mounted robots and upper-limb rehabilitation systems.'
]))
story.append(job('2024', 'Research Professor', 'Universidad Tecnológica de la Mixteca, Mexico', [
    'Developed and tested an optimization strategy for a 7-DoF robot, improving tracking performance by 20 percent.',
    'Supported the mechanical design of a three-finger adaptive robotic gripper for activities of daily living.',
    'Led a national student race-vehicle project through design, construction, testing, and competition.'
]))
story.append(job('2020-2023', 'Research Assistant', 'ÉTS, Montréal', [
    'Deployed closed-form inverse kinematics in approximately 5 microseconds and learning-based inverse kinematics in approximately 43 microseconds.',
    'Developed a 1 to 4 kHz hard real-time motion-control stack and deployed learning-based predictive control in approximately 387 microseconds.',
    'Reduced symbolic model-expression size by approximately 90 percent and computed feedforward torque in approximately 210 microseconds.',
    'Built LabVIEW and Simscape digital twins and integrated EMG, IMU, and depth-camera sensing.',
    'Designed an EMG and IMU mirror-rehabilitation system for upper-limb therapy.'
]))
story.append(job('2019', 'Research Professor', 'Universidad de la Sierra Juárez, Mexico', [
    'Implemented neural-network inverse kinematics for a 6-DoF PUMA robot.',
    'Developed a MATLAB convolutional neural network for wildlife detection in camera-trap datasets.'
]))
story.append(job('2017-2018', 'Professor', 'Tecnológico Nacional de México, Mexico', [
    'Deployed a real-time robotic manipulator emulator on a TI microcontroller with a 10 microsecond sampling period.',
    'Implemented an FPGA-based voice-processing system using linear predictive coding.'
]))

story += section('Education')
edu = [
    ['2020-2023', '<b>PhD in Robotics</b><br/>Learning-Based Upper-Limb Robotic Rehabilitation, ÉTS, Montréal'],
    ['2014-2016', '<b>M.Sc. in Robotics</b><br/>Hardware-in-the-Loop Simulation of a Robotic Manipulator, Universidad Tecnológica de la Mixteca'],
    ['2009-2014', '<b>B.Eng. in Mechatronics</b><br/>Universidad Tecnológica de la Mixteca, CENEVAL EGEL Outstanding distinction']
]
t = Table([[Paragraph(a, styles['Meta']), Paragraph(b, styles['BodySmall'])] for a,b in edu], colWidths=[1.05*inch, 6.05*inch], hAlign='LEFT')
t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
story.append(t)

story += section('Selected Publications')
pubs = [
    '<b>Bedolla-Martínez, D.</b>, Kali, Y., Saad, M., Ochoa-Luna, C., and Rahman, M. H. (2023). <i>Learning human inverse kinematics solutions for redundant robotic upper-limb rehabilitation.</i> Engineering Applications of Artificial Intelligence, 126, 106966. DOI: 10.1016/j.engappai.2023.106966.',
    '<b>Bedolla-Martínez, D.</b>, Kali, Y., Saad, M., Ochoa-Luna, C., and Rahman, M. H. (2023). <i>Robust MPC with Integral Super-Twisting for Trajectory Tracking of an Exoskeleton Robot Arm.</i> IEEE PEDS. DOI: 10.1109/PEDS57185.2023.10246735.',
    '<b>Bedolla-Martínez, D.</b> (2023). <i>Learning-Based Upper Limb Robotic Rehabilitation.</i> Doctoral dissertation, ÉTS.'
]
for p in pubs:
    story.append(Paragraph('• ' + p, styles['Pub']))

story += section('Selected Projects')
projects = [
    '<b>Whole-Body Mobile Manipulation:</b> 400 Hz ROS 2 and C++ coordination of a mobile base and Kinova Gen3 arm.',
    '<b>Dynamics Forge:</b> Interactive modeling and control platform for copters, drones, pendulums, cart-pole systems, and manipulators.',
    '<b>Automatic Robotics Tooling:</b> Symbolic kinematics, inverse kinematics, RNEA, and expression-optimization tools for serial and branched robots.',
    '<b>Learning-Based Rehabilitation:</b> Gaussian Process inverse kinematics, robust predictive control, and sensor-driven mirror therapy.'
]
for p in projects:
    story.append(Paragraph('• ' + p, styles['Pub']))

story += section('Awards and Scholarships')
awards = [
    ['2024', '<b>ÉTS Excellence Award nomination</b>'],
    ['2020', '<b>Doctoral scholarship</b> - National Mexican Council of Humanities, Science and Technology'],
    ['2014', '<b>Master\'s scholarship</b> - National Mexican Council of Humanities, Science and Technology']
]
aw = Table([[Paragraph(a, styles['Meta']), Paragraph(b, styles['BodySmall'])] for a,b in awards], colWidths=[0.7*inch, 6.4*inch], hAlign='LEFT')
aw.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BOTTOMPADDING',(0,0),(-1,-1),3)]))
story.append(aw)

story += section('Technical Skills')
skills_data = [
    [Paragraph('<b>Programming</b>', styles['SkillCell']), Paragraph('C, C++, Python, MATLAB, LabVIEW, VHDL', styles['SkillCell'])],
    [Paragraph('<b>Robotics</b>', styles['SkillCell']), Paragraph('ROS 2, Pinocchio, URDF, motion planning, real-time control, mobile manipulation', styles['SkillCell'])],
    [Paragraph('<b>Modeling and Control</b>', styles['SkillCell']), Paragraph('Kinematics, dynamics, RNEA, MPC, sliding-mode control, reinforcement learning, Gaussian Processes', styles['SkillCell'])],
    [Paragraph('<b>Simulation and Hardware</b>', styles['SkillCell']), Paragraph('Simulink, Simscape Multibody, LabVIEW RT and FPGA, DAQ, microcontrollers, IMU, EMG, depth cameras', styles['SkillCell'])]
]
sk = Table(skills_data, colWidths=[1.55*inch, 5.55*inch], hAlign='LEFT')
sk.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('ROWBACKGROUNDS',(0,0),(-1,-1),[colors.white, colors.HexColor('#F7F9FC')]),('BOX',(0,0),(-1,-1),0.35,LIGHT),('INNERGRID',(0,0),(-1,-1),0.25,LIGHT),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3)]))
story.append(sk)

doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(out)
